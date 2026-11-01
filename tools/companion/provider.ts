import { validateOutput, type Capability, type Worker, type WorkerOutput } from './core.js';
/** Explicit gap, usable without credentials or network access. */
export function notConfiguredWorker(): Worker {
    return { kind: 'api', capability: { status: 'NOT_CONFIGURED', provider: '', model: '', accessVerified: false, costApproved: false, observedAt: '' }, execute: async () => { throw new Error('API worker NOT_CONFIGURED'); } };
}
/** Small boundary for a user-authorized API transport. No endpoint/model/key discovery. */
export function apiWorker(capability: Capability, request: (input: Parameters<Worker['execute']>[0]) => Promise<{
    requestId: string;
    changes: unknown;
}>): Worker {
    return { kind: 'api', capability: { ...capability }, execute: async (input): Promise<WorkerOutput> => {
            const response = await request(input);
            if (input.signal.aborted)
                throw new Error('API request aborted');
            return validateOutput(input.contract, { externalRunId: response.requestId, changes: response.changes });
        } };
}
