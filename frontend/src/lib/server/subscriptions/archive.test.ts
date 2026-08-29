import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archiveSurplusForFreeDowngrade, reactivateArchivedForProUpgrade } from './archive';

const findMany = vi.fn();
const updateMany = vi.fn();
const goalUpdateMany = vi.fn();

const client = {
  envelope: { findMany, updateMany },
  savingsGoal: { updateMany: goalUpdateMany },
} as unknown as Parameters<typeof archiveSurplusForFreeDowngrade>[0];

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  goalUpdateMany.mockReset();
});

describe('archiveSurplusForFreeDowngrade', () => {
  it('archives the oldest envelopes beyond the Free limit (2), keeps the 2 newest active', async () => {
    findMany.mockResolvedValue([
      { id: 'e-oldest' },
      { id: 'e-middle' },
      { id: 'e-newer' },
      { id: 'e-newest' },
    ]); // pre-sorted ascending by createdAt, as the real query does
    goalUpdateMany.mockResolvedValue({ count: 0 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e-oldest', 'e-middle'] } },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('does nothing to envelopes when already at or under the Free limit', async () => {
    findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    goalUpdateMany.mockResolvedValue({ count: 0 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('archives every active savings goal (Free allows 0)', async () => {
    findMany.mockResolvedValue([]);
    goalUpdateMany.mockResolvedValue({ count: 3 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(goalUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
  });
});

describe('reactivateArchivedForProUpgrade', () => {
  it('reactivates every archived envelope and savings goal for the user', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    goalUpdateMany.mockResolvedValue({ count: 1 });

    await reactivateArchivedForProUpgrade(client, 'u1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    expect(goalUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });
});
