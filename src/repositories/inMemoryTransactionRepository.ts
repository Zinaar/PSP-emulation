import { TransactionStatus } from '../enums/transactionStatus';
import {
    ITransactionRepository,
    TransactionRecord,
    CreateTransactionData,
    UpdateExtraFields,
} from '../types/transaction';

/**
 * In-memory transaction repository for testing.
 * Implements the same interface as TransactionRepository
 * but uses a Map instead of PostgreSQL.
 */
export class InMemoryTransactionRepository implements ITransactionRepository {
    private transactions: Map<string, TransactionRecord> = new Map();

    async create(transactionData: CreateTransactionData): Promise<TransactionRecord> {
        const record: TransactionRecord = {
            ...transactionData,
            pspTransactionId: null,
            finalAmount: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.transactions.set(record.id, record);
        return { ...record };
    }

    async findById(transactionId: string): Promise<TransactionRecord | null> {
        const transaction = this.transactions.get(transactionId);
        return transaction ? { ...transaction } : null;
    }

    async findByPspTransactionId(pspTransactionId: string): Promise<TransactionRecord | null> {
        for (const transaction of this.transactions.values()) {
            if (transaction.pspTransactionId === pspTransactionId) {
                return { ...transaction };
            }
        }
        return null;
    }

    async updateStatus(
        transactionId: string,
        status: TransactionStatus,
        extraFields: UpdateExtraFields = {},
    ): Promise<TransactionRecord> {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction not found: ${transactionId}`);
        }

        transaction.status = status;
        transaction.updatedAt = new Date();

        if (extraFields.pspTransactionId !== undefined) {
            transaction.pspTransactionId = extraFields.pspTransactionId;
        }
        if (extraFields.finalAmount !== undefined) {
            transaction.finalAmount = extraFields.finalAmount;
        }

        return { ...transaction };
    }

    /**
     * Simulates atomic find-and-lock for testing.
     * In-memory implementation doesn't need real locking, but provides the same interface.
     */
    async findAndLockByPspTransactionId(pspTransactionId: string) {
        const transaction = await this.findByPspTransactionId(pspTransactionId);

        return {
            transaction,
            updateStatus: async (status: TransactionStatus, extraFields: UpdateExtraFields = {}) => {
                if (!transaction) {
                    throw new Error('Cannot update: transaction not found');
                }
                return this.updateStatus(transaction.id, status, extraFields);
            },
            commit: async () => { /* no-op for in-memory */ },
            rollback: async () => { /* no-op for in-memory */ },
        };
    }

    /**
     * Clears all stored transactions. Useful for test cleanup.
     */
    clear(): void {
        this.transactions.clear();
    }
}
