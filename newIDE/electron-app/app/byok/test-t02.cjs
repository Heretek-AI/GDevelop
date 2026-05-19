'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  createRequest,
  getRequest,
  abortRequest,
  cleanupRequest,
  getActiveRequests,
  _size,
  _reset,
} = require('./requestStore');

// ── Helpers ───────────────────────────────────────────────────────────

/** Return a fresh unique request ID for each test. */
let _counter = 0;
function nextId() {
  return `req-${++_counter}`;
}

// ─── requestStore ─────────────────────────────────────────────────────

describe('requestStore', () => {
  // Ensure a clean slate before and after every test so tests are isolated.
  beforeEach(() => { _reset(); _counter = 0; });
  afterEach(() => { _reset(); });

  // ── createRequest ──────────────────────────────────────────────

  describe('createRequest', () => {
    it('creates a request entry and returns it', () => {
      const id = nextId();
      const entry = createRequest(id);
      assert.ok(entry.abortController instanceof AbortController);
      assert.strictEqual(entry.status, 'pending');
      assert.strictEqual(typeof entry.startTime, 'number');
      assert.strictEqual(entry.error, null);
    });

    it('stores the entry so getRequest can find it', () => {
      const id = nextId();
      createRequest(id);
      const found = getRequest(id);
      assert.ok(found, 'getRequest should find the entry');
      assert.strictEqual(found.status, 'pending');
    });

    it('throws when creating a duplicate request ID', () => {
      const id = nextId();
      createRequest(id);
      assert.throws(
        () => createRequest(id),
        /already exists/
      );
    });

    it('increments store size', () => {
      assert.strictEqual(_size(), 0);
      createRequest(nextId());
      assert.strictEqual(_size(), 1);
      createRequest(nextId());
      assert.strictEqual(_size(), 2);
    });
  });

  // ── getRequest ─────────────────────────────────────────────────

  describe('getRequest', () => {
    it('returns undefined for unknown IDs', () => {
      assert.strictEqual(getRequest('nonexistent'), undefined);
    });

    it('returns the same object returned by createRequest', () => {
      const id = nextId();
      const created = createRequest(id);
      const found = getRequest(id);
      assert.strictEqual(found, created);
    });
  });

  // ── abortRequest ───────────────────────────────────────────────

  describe('abortRequest', () => {
    it('aborts the underlying AbortController', () => {
      const id = nextId();
      const entry = createRequest(id);
      assert.strictEqual(entry.abortController.signal.aborted, false);
      abortRequest(id);
      assert.strictEqual(entry.abortController.signal.aborted, true);
    });

    it('sets status to "aborted"', () => {
      const id = nextId();
      createRequest(id);
      abortRequest(id);
      const entry = getRequest(id);
      assert.strictEqual(entry.status, 'aborted');
    });

    it('returns true on success', () => {
      const id = nextId();
      createRequest(id);
      assert.strictEqual(abortRequest(id), true);
    });

    it('returns false for unknown IDs', () => {
      assert.strictEqual(abortRequest('ghost'), false);
    });
  });

  // ── cleanupRequest ─────────────────────────────────────────────

  describe('cleanupRequest', () => {
    it('removes the entry from the store', () => {
      const id = nextId();
      createRequest(id);
      assert.strictEqual(_size(), 1);
      cleanupRequest(id);
      assert.strictEqual(_size(), 0);
      assert.strictEqual(getRequest(id), undefined);
    });

    it('returns true when an entry was removed', () => {
      const id = nextId();
      createRequest(id);
      assert.strictEqual(cleanupRequest(id), true);
    });

    it('returns false for unknown IDs', () => {
      assert.strictEqual(cleanupRequest('ghost'), false);
    });
  });

  // ── getActiveRequests ──────────────────────────────────────────

  describe('getActiveRequests', () => {
    it('returns an empty array when store is empty', () => {
      assert.deepStrictEqual(getActiveRequests(), []);
    });

    it('includes pending requests', () => {
      const id = nextId();
      createRequest(id);
      const active = getActiveRequests();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].id, id);
      assert.strictEqual(active[0].status, 'pending');
    });

    it('includes streaming requests', () => {
      const id = nextId();
      const entry = createRequest(id);
      entry.status = 'streaming';
      const active = getActiveRequests();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].status, 'streaming');
    });

    it('excludes aborted requests', () => {
      const id = nextId();
      createRequest(id);
      abortRequest(id);
      assert.deepStrictEqual(getActiveRequests(), []);
    });

    it('excludes completed requests', () => {
      const id = nextId();
      const entry = createRequest(id);
      entry.status = 'completed';
      assert.deepStrictEqual(getActiveRequests(), []);
    });

    it('excludes errored requests', () => {
      const id = nextId();
      const entry = createRequest(id);
      entry.status = 'errored';
      assert.deepStrictEqual(getActiveRequests(), []);
    });

    it('returns correct shape for multiple mixed-status entries', () => {
      createRequest('a');
      createRequest('b');
      const c = createRequest('c');
      c.status = 'completed';
      const d = createRequest('d');
      d.status = 'streaming';
      createRequest('e');
      abortRequest('e');

      const active = getActiveRequests();
      assert.strictEqual(active.length, 3, 'expected 3 active (a, b, d)');
      const ids = active.map((r) => r.id).sort();
      assert.deepStrictEqual(ids, ['a', 'b', 'd']);
      for (const r of active) {
        assert.ok(typeof r.id === 'string');
        assert.ok(['pending', 'streaming'].includes(r.status));
        assert.ok(typeof r.startTime === 'number');
      }
    });
  });

  // ── AbortController signal integration ─────────────────────────

  describe('AbortController integration', () => {
    it('abort controller signal fires on abort', () => {
      const id = nextId();
      const entry = createRequest(id);
      let aborted = false;
      entry.abortController.signal.addEventListener('abort', () => {
        aborted = true;
      });
      abortRequest(id);
      assert.strictEqual(aborted, true);
    });

    it('each request has an independent AbortController', () => {
      const a = createRequest(nextId());
      const b = createRequest(nextId());
      assert.notStrictEqual(a.abortController, b.abortController);
    });
  });
});
