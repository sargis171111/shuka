import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';

const BASE_URL = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data');
const DB_PATH = path.join(DATA_DIR, 'shuka.db');

class TestClient {
  constructor(name) {
    this.name = name;
    this.cookie = '';
  }

  async req(apiPath, { method = 'GET', body, headers = {} } = {}) {
    const isForm = body instanceof FormData;
    const reqHeaders = { ...headers };
    if (this.cookie) reqHeaders.Cookie = this.cookie;
    if (!isForm && body !== undefined && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE_URL}${apiPath}`, {
      method,
      headers: reqHeaders,
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length > 0) {
      this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    } else {
      const single = res.headers.get('set-cookie');
      if (single) this.cookie = single.split(';')[0];
    }

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, data };
  }

  async login(email, password) {
    const res = await this.req('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(res.status, 200, `${this.name} login failed: ${JSON.stringify(res.data)}`);
    return res.data.user;
  }

  async register(email, password, name, phone = '+374 99 101010') {
    const res = await this.req('/api/auth/register', {
      method: 'POST',
      body: { email, password, name, phone },
    });
    assert.equal(res.status, 201, `${this.name} register failed: ${JSON.stringify(res.data)}`);
    return res.data.user;
  }
}

function defaultAddress(recipient = 'Test Buyer') {
  return {
    recipient,
    phone: '+374 99 123456',
    region: 'Yerevan',
    city: 'Yerevan',
    street: 'Mashtots Ave 15',
    apartment: 'Apt 8',
    note: 'Break-it automated test',
  };
}

async function run() {
  console.log(`\nRunning Shuka Break-It Suite against ${BASE_URL}\n`);

  const sellerA = new TestClient('SellerA');
  const sellerB = new TestClient('SellerB');
  const buyerA = new TestClient('BuyerA');
  const buyerB = new TestClient('BuyerB');

  await sellerA.login('aram@yerevantech.am', 'Seller123!');
  await sellerB.login('ani@ararathome.am', 'Seller123!');
  await buyerA.login('narek@demo.am', 'Buyer123!');
  await buyerB.login('mariam@demo.am', 'Buyer123!');

  // Clear any leftover cart items on demo buyers before starting
  for (const b of [buyerA, buyerB]) {
    const cart = await b.req('/api/cart');
    for (const s of cart.data.sellers || []) {
      for (const it of s.items) {
        await b.req(`/api/cart/items/${it.product_id}`, { method: 'DELETE' });
      }
    }
  }

  const catRes = await sellerA.req('/api/categories');
  assert.equal(catRes.status, 200);
  const categoryId = catRes.data.categories[0].id;
  const createdTestProductIds = [];

  const createTestProduct = async (sellerClient, overrides = {}) => {
    const res = await sellerClient.req('/api/seller/products', {
      method: 'POST',
      body: {
        title: `Test Item ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Automated test product created by break-it verification suite.',
        category_id: categoryId,
        price_amd: 10000,
        stock: 5,
        is_published: 1,
        ...overrides,
      },
    });
    assert.equal(res.status, 201, `Create product failed: ${JSON.stringify(res.data)}`);
    createdTestProductIds.push({ seller: sellerClient, id: res.data.product.id });
    return res.data.product;
  };

  const results = [];
  const testCase = async (num, name, fn) => {
    try {
      await fn();
      console.log(`PASS [${num}/9] ${name}`);
      results.push({ num, name, ok: true });
    } catch (err) {
      console.error(`FAIL [${num}/9] ${name}:`, err);
      results.push({ num, name, ok: false, err });
    }
  };

  // 1. Last units: stock=3, 30 concurrent checkouts of 1 unit -> 3 succeed (201), 27 return 409, stock=0
  await testCase(1, 'Last units (stock=3, 30 concurrent checkouts)', async () => {
    const product = await createTestProduct(sellerA, {
      title: 'Limited Stock Flash Item',
      stock: 3,
      price_amd: 15000,
    });

    const stamp = Date.now();
    const racers = await Promise.all(
      Array.from({ length: 30 }, async (_, idx) => {
        const c = new TestClient(`Racer-${idx}`);
        await c.register(`racer-${stamp}-${idx}@test.am`, 'TestPass123!', `Racer ${idx}`);
        const addRes = await c.req(`/api/cart/items/${product.id}`, {
          method: 'PUT',
          body: { quantity: 1 },
        });
        assert.equal(addRes.status, 200);
        return c;
      })
    );

    const responses = await Promise.all(
      racers.map((c, idx) =>
        c.req('/api/orders', {
          method: 'POST',
          body: {
            request_key: crypto.randomUUID(),
            ...defaultAddress(`Racer ${idx}`),
          },
        })
      )
    );

    const status201 = responses.filter((r) => r.status === 201);
    const status409 = responses.filter((r) => r.status === 409);
    const other = responses.filter((r) => r.status !== 201 && r.status !== 409);

    assert.equal(other.length, 0, `Unexpected statuses (possible SQLITE_BUSY/500): ${JSON.stringify(other)}`);
    assert.equal(status201.length, 3, `Expected 3 successes, got ${status201.length}`);
    assert.equal(status409.length, 27, `Expected 27 conflicts, got ${status409.length}`);

    const after = await sellerA.req(`/api/seller/products/${product.id}`);
    assert.equal(after.data.product.stock, 0, 'Final stock must equal 0');
  });

  // 2. Double click: 2 requests with same request_key -> 1 order created
  await testCase(2, 'Double click idempotency (same request_key)', async () => {
    const product = await createTestProduct(sellerA, {
      title: 'Double Click Guard Item',
      stock: 5,
      price_amd: 9500,
    });

    await buyerA.req(`/api/cart/items/${product.id}`, {
      method: 'PUT',
      body: { quantity: 2 },
    });

    const key = crypto.randomUUID();
    const payload = { request_key: key, ...defaultAddress('Narek Petrosyan') };

    const first = await buyerA.req('/api/orders', { method: 'POST', body: payload });
    const second = await buyerA.req('/api/orders', { method: 'POST', body: payload });

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.data.order.id, first.data.order.id);

    const prodAfter = await sellerA.req(`/api/seller/products/${product.id}`);
    assert.equal(prodAfter.data.product.stock, 3, 'Stock should only be deducted once');
  });

  // 3. Price changed: add to cart -> seller raises price -> checkout returns 409 with new price
  await testCase(3, 'Price changed guard during checkout', async () => {
    const product = await createTestProduct(sellerA, {
      title: 'Price Guard Speaker',
      stock: 5,
      price_amd: 12000,
    });

    await buyerA.req(`/api/cart/items/${product.id}`, {
      method: 'PUT',
      body: { quantity: 1 },
    });

    const patchRes = await sellerA.req(`/api/seller/products/${product.id}`, {
      method: 'PATCH',
      body: { price_amd: 16500 },
    });
    assert.equal(patchRes.status, 200);

    const checkoutRes = await buyerA.req('/api/orders', {
      method: 'POST',
      body: { request_key: crypto.randomUUID(), ...defaultAddress('Narek Petrosyan') },
    });

    assert.equal(checkoutRes.status, 409);
    assert.equal(checkoutRes.data.error.code, 'PRICE_CHANGED');
    assert.ok(
      checkoutRes.data.error.message.includes('16500'),
      `Expected error message to include new price 16500: ${checkoutRes.data.error.message}`
    );
    assert.equal(checkoutRes.data.error.changed_items[0].new_price_amd, 16500);

    await buyerA.req(`/api/cart/items/${product.id}`, { method: 'DELETE' });
  });

  // 4. Old order after edit: edit ordered product title & price -> old order retains snapshot
  let sharedOrderId;
  let sharedSellerOrderId;
  await testCase(4, 'Old order retains price & title snapshot after edit', async () => {
    const product = await createTestProduct(sellerA, {
      title: 'Original Snapshot Keyboard',
      stock: 5,
      price_amd: 25000,
    });

    await buyerA.req(`/api/cart/items/${product.id}`, {
      method: 'PUT',
      body: { quantity: 1 },
    });

    const orderRes = await buyerA.req('/api/orders', {
      method: 'POST',
      body: { request_key: crypto.randomUUID(), ...defaultAddress('Narek Petrosyan') },
    });
    assert.equal(orderRes.status, 201);
    sharedOrderId = orderRes.data.order.id;
    sharedSellerOrderId = orderRes.data.order.seller_orders[0].id;

    const editRes = await sellerA.req(`/api/seller/products/${product.id}`, {
      method: 'PATCH',
      body: { title: 'Edited New Keyboard Name', price_amd: 39000 },
    });
    assert.equal(editRes.status, 200);

    const fetched = await buyerA.req(`/api/orders/${sharedOrderId}`);
    assert.equal(fetched.status, 200);
    const snapItem = fetched.data.order.seller_orders[0].items[0];
    assert.equal(snapItem.title, 'Original Snapshot Keyboard');
    assert.equal(snapItem.unit_price_amd, 25000);
  });

  // 5. Someone else's order + own product protection
  await testCase(5, 'Strict authorization (IDOR & own-product blocked)', async () => {
    const sellerOwnProduct = await createTestProduct(sellerA, {
      title: 'Seller Own Auth Check',
      stock: 5,
      price_amd: 5000,
    });

    const ownCartRes = await sellerA.req(`/api/cart/items/${sellerOwnProduct.id}`, {
      method: 'PUT',
      body: { quantity: 1 },
    });
    assert.equal(ownCartRes.status, 403);

    const sellerLeakGet = await sellerB.req(`/api/seller/orders/${sharedSellerOrderId}`);
    assert.ok([403, 404].includes(sellerLeakGet.status), `Expected 403/404, got ${sellerLeakGet.status}`);
    assert.equal(sellerLeakGet.data.order, undefined);

    const sellerLeakPost = await sellerB.req(`/api/seller/orders/${sharedSellerOrderId}/status`, {
      method: 'POST',
      body: { to: 'confirmed' },
    });
    assert.ok([403, 404].includes(sellerLeakPost.status));

    const buyerLeakGet = await buyerB.req(`/api/orders/${sharedOrderId}`);
    assert.ok([403, 404].includes(buyerLeakGet.status), `Expected 403/404, got ${buyerLeakGet.status}`);
    assert.equal(buyerLeakGet.data.order, undefined);

    const buyerLeakCancel = await buyerB.req(
      `/api/orders/${sharedOrderId}/sellers/${sharedSellerOrderId}/cancel`,
      { method: 'POST' }
    );
    assert.ok([403, 404].includes(buyerLeakCancel.status));
  });

  // 6. Move not allowed: placed -> delivered and buyer cancelling shipped -> 409 unchanged
  await testCase(6, 'Strict state machine rejects invalid transitions (409)', async () => {
    const skipRes = await sellerA.req(`/api/seller/orders/${sharedSellerOrderId}/status`, {
      method: 'POST',
      body: { to: 'delivered' },
    });
    assert.equal(skipRes.status, 409);

    const checkPlaced = await sellerA.req(`/api/seller/orders/${sharedSellerOrderId}`);
    assert.equal(checkPlaced.data.order.status, 'placed');

    const confirmRes = await sellerA.req(`/api/seller/orders/${sharedSellerOrderId}/status`, {
      method: 'POST',
      body: { to: 'confirmed' },
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.order.status, 'confirmed');

    const shipRes = await sellerA.req(`/api/seller/orders/${sharedSellerOrderId}/status`, {
      method: 'POST',
      body: { to: 'shipped' },
    });
    assert.equal(shipRes.status, 200);
    assert.equal(shipRes.data.order.status, 'shipped');

    const cancelShippedRes = await buyerA.req(
      `/api/orders/${sharedOrderId}/sellers/${sharedSellerOrderId}/cancel`,
      { method: 'POST' }
    );
    assert.equal(cancelShippedRes.status, 409);

    const checkShipped = await sellerA.req(`/api/seller/orders/${sharedSellerOrderId}`);
    assert.equal(checkShipped.data.order.status, 'shipped');
  });

  // 7. Cancel returns stock: buyer cancels placed order -> stock restored
  await testCase(7, 'Buyer cancellation restores product stock', async () => {
    const product = await createTestProduct(sellerB, {
      title: 'Cancellable Copper Pot',
      stock: 4,
      price_amd: 13000,
    });

    await buyerB.req(`/api/cart/items/${product.id}`, {
      method: 'PUT',
      body: { quantity: 2 },
    });

    const orderRes = await buyerB.req('/api/orders', {
      method: 'POST',
      body: { request_key: crypto.randomUUID(), ...defaultAddress('Mariam Avetisyan') },
    });
    assert.equal(orderRes.status, 201);

    const afterOrderProd = await sellerB.req(`/api/seller/products/${product.id}`);
    assert.equal(afterOrderProd.data.product.stock, 2);

    const soId = orderRes.data.order.seller_orders[0].id;
    const cancelRes = await buyerB.req(
      `/api/orders/${orderRes.data.order.id}/sellers/${soId}/cancel`,
      { method: 'POST' }
    );
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.order.seller_orders[0].status, 'cancelled');

    const afterCancelProd = await sellerB.req(`/api/seller/products/${product.id}`);
    assert.equal(afterCancelProd.data.product.stock, 4, 'Stock must be restored to 4');
  });

  // 8. Foreign keys: direct SQL insert of order_items with nonexistent product_id & delete ordered product
  await testCase(8, 'SQLite foreign keys & ON DELETE RESTRICT enforced', async () => {
    const db = new Database(DB_PATH);
    try {
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');

      const anySellerOrder = db.prepare(`SELECT id FROM seller_orders LIMIT 1`).get();
      assert.ok(anySellerOrder, 'Expected at least one seller_order row');

      let badInsertRejected = false;
      try {
        db.prepare(
          `INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity)
           VALUES (?, 99999999, 'Ghost Product', 1000, 1)`
        ).run(anySellerOrder.id);
      } catch (err) {
        assert.equal(err.code, 'SQLITE_CONSTRAINT_FOREIGNKEY');
        badInsertRejected = true;
      }
      assert.ok(badInsertRejected, 'Insert with nonexistent product_id must fail');

      const orderedItem = db.prepare(`SELECT product_id FROM order_items LIMIT 1`).get();
      let deleteRestricted = false;
      try {
        db.prepare(`DELETE FROM products WHERE id = ?`).run(orderedItem.product_id);
      } catch (err) {
        assert.ok(
          ['SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_CONSTRAINT_TRIGGER'].includes(err.code),
          `Expected foreign key constraint code, got ${err.code}: ${err.message}`
        );
        assert.match(err.message, /FOREIGN KEY/i);
        deleteRestricted = true;
      }
      assert.ok(deleteRestricted, 'Deleting ordered product must fail ON DELETE RESTRICT');
    } finally {
      db.close();
    }
  });

  // 9. Bad upload: 30MB payload and fake .exe renamed to .jpg -> both rejected with 400 + clear message
  await testCase(9, 'Bad uploads rejected (30MB & fake .exe as .jpg -> 400)', async () => {
    const product = await createTestProduct(sellerA, {
      title: 'Upload Validation Target',
      stock: 2,
      price_amd: 11000,
    });

    // 9a: 30MB file
    const bigForm = new FormData();
    const thirtyMb = Buffer.alloc(30 * 1024 * 1024, 0x41);
    bigForm.append('images', new Blob([thirtyMb], { type: 'image/jpeg' }), 'huge.jpg');
    const bigRes = await sellerA.req(`/api/seller/products/${product.id}/images`, {
      method: 'POST',
      body: bigForm,
    });
    assert.equal(bigRes.status, 400, `Expected 400 for 30MB upload, got ${bigRes.status}`);
    assert.ok(bigRes.data?.error?.message, 'Expected clear error message for 30MB upload');

    // 9b: Fake .exe renamed to .jpg
    const exeForm = new FormData();
    const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This program cannot be run in DOS mode');
    exeForm.append('images', new Blob([fakeExe], { type: 'image/jpeg' }), 'fake.jpg');
    const exeRes = await sellerA.req(`/api/seller/products/${product.id}/images`, {
      method: 'POST',
      body: exeForm,
    });
    assert.equal(exeRes.status, 400, `Expected 400 for fake exe, got ${exeRes.status}`);
    assert.equal(exeRes.data?.error?.code, 'INVALID_IMAGE');
    assert.ok(exeRes.data?.error?.message, 'Expected clear error message for fake .jpg');

    // 9c: Valid PNG succeeds with 201
    const validPng = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 245, g: 158, b: 11 } },
    })
      .png()
      .toBuffer();
    const validForm = new FormData();
    validForm.append('images', new Blob([validPng], { type: 'image/png' }), 'valid.png');
    const validRes = await sellerA.req(`/api/seller/products/${product.id}/images`, {
      method: 'POST',
      body: validForm,
    });
    assert.equal(validRes.status, 201);
    assert.equal(validRes.data.images.length, 1);
  });

  // Unpublish synthetic test products so the storefront remains clean after testing
  for (const item of createdTestProductIds) {
    await item.seller.req(`/api/seller/products/${item.id}`, {
      method: 'PATCH',
      body: { is_published: 0 },
    });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nSummary: ${passed}/9 PASS\n`);
  if (passed !== 9) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Break-it suite aborted:', err);
  process.exit(1);
});
