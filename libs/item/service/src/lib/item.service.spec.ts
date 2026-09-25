import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { AsyncResult, err, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import {
  Authorization,
  Category,
  Extraction,
  Id,
  User,
  Url,
  Wishlist,
} from '@wish-list/domain';
import type { ExtractionReason, SucceededExtraction } from '@wish-list/domain';
import type { ItemRepository } from '@wish-list/database';
import type { Extractor } from '@wish-list/extraction';
import { ExtractionFailure } from '@wish-list/extraction';
import { ItemService } from './item.service.js';
import type { CreateItemInput } from './item.service.types.js';

const USER = Id.generate();
const WISHLIST = Id.generate();
const CATEGORY = Id.generate();
const URL = 'https://acme.example/p/trail-runner-3';

function userFixture(id: Id): User {
  const user = User.create({
    email: 'wisher@example.com',
    name: 'Wisher',
    provider: 'google',
    providerId: 'google-1',
  }).unwrapOr(undefined as never);
  return { ...user, id };
}

function wishlistFixture(user: Id): Wishlist {
  const wishlist = Wishlist.create({ user, name: 'Birthday' }).unwrapOr(
    undefined as never,
  );
  return { ...wishlist, id: WISHLIST };
}

function categoryFixture(user: Id): Category {
  const category = Category.create({ user, name: 'Electronics' }).unwrapOr(
    undefined as never,
  );
  return { ...category, id: CATEGORY };
}

function succeededExtraction(name = 'Trail Runner 3'): SucceededExtraction {
  return Extraction.succeeded({
    url: Url.from(URL),
    vendor: Id.generate(),
    source: 'json-ld',
    data: {
      name,
      price: { amount: 129.99, currency: 'USD' },
      image: Url.from('https://cdn.acme.example/trail-runner-3.jpg'),
    },
    vendorData: {
      name: 'Acme Outfitters',
      website: Url.from('https://acme.example'),
      currency: 'USD',
    },
  });
}

function failedExtraction(reason: ExtractionReason): Extraction {
  return Extraction.failed({ url: Url.from(URL), vendor: Id.generate(), reason });
}

interface Stubs {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly extract: ReturnType<typeof vi.fn>;
}

function buildStubs(): Stubs {
  return {
    insert: vi.fn(
      (item) => AsyncResult.fromResult(ok(item)) as AsyncResult<never, never>,
    ),
    extract: vi.fn(
      (): AsyncResult<Extraction, ExtractionFailure> =>
        AsyncResult.fromResult(ok(succeededExtraction())),
    ),
  };
}

function buildService(stubs: Stubs): ItemService {
  return new ItemService(
    { insert: stubs.insert } as unknown as ItemRepository,
    { extract: stubs.extract } as unknown as Extractor,
  );
}

function createInput(): CreateItemInput {
  const authorized = new Authorization(userFixture(USER))
    .authorize({
      wishlist: wishlistFixture(USER),
      category: categoryFixture(USER),
    })
    .unwrapOr(undefined as never);

  return { authorized, url: Url.from(URL) };
}

describe('ItemService', () => {
  describe('create', () => {
    it('wraps an Extractor failure as unexpected and creates no Item', async () => {
      const stubs = buildStubs();
      stubs.extract.mockReturnValue(
        AsyncResult.fromResult(
          err(ExtractionFailure.persistFailed(Failure.create('query', 'boom'))),
        ),
      );
      const service = buildService(stubs);

      const failure = await service
        .create(createInput())
        .match({ ok: () => undefined, err: (f) => f });

      expect(failure?.name).toBe('unexpected');
      expect(stubs.insert).not.toHaveBeenCalled();
    });

    it('creates and inserts an ExtractedItem for a succeeded Extraction', async () => {
      const stubs = buildStubs();
      const extraction = succeededExtraction();
      stubs.extract.mockReturnValue(AsyncResult.fromResult(ok(extraction)));
      const service = buildService(stubs);

      const item = await service
        .create(createInput())
        .match({ ok: (value) => value, err: () => undefined });

      expect(stubs.insert).toHaveBeenCalledTimes(1);
      expect(item?._tag).toBe('extracted');
      if (item?._tag === 'extracted') {
        expect(item.vendor).toBe(extraction.vendor);
        expect(item.name).toBe(extraction.data.name);
        expect(item.price).toEqual(extraction.data.price);
        expect(item.image).toBe(extraction.data.image);
      }
    });

    it('downgrades a succeeded Extraction with an empty name to a FailedExtractionItem', async () => {
      const stubs = buildStubs();
      stubs.extract.mockReturnValue(
        AsyncResult.fromResult(ok(succeededExtraction(''))),
      );
      const service = buildService(stubs);

      const item = await service
        .create(createInput())
        .match({ ok: (value) => value, err: () => undefined });

      expect(item?._tag).toBe('failed');
      if (item?._tag === 'failed') {
        expect(item.reason).toBe('invalid-data');
      }
      expect(stubs.insert).toHaveBeenCalledTimes(1);
    });

    it('creates and inserts a FailedExtractionItem for a failed Extraction', async () => {
      const stubs = buildStubs();
      const extraction = failedExtraction('llm-failed');
      stubs.extract.mockReturnValue(AsyncResult.fromResult(ok(extraction)));
      const service = buildService(stubs);

      const item = await service
        .create(createInput())
        .match({ ok: (value) => value, err: () => undefined });

      expect(item?._tag).toBe('failed');
      if (item?._tag === 'failed') {
        expect(item.reason).toBe('llm-failed');
      }
      expect(stubs.insert).toHaveBeenCalledTimes(1);
    });
  });
});
