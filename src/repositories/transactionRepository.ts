import { Pool } from 'pg';
import { TransactionStatus } from '../enums/transactionStatus';
import {
    ITransactionRepository,
    TransactionRecord,
    CreateTransactionData,
    UpdateExtraFields,
} from '../types/transaction';

/**
 * PostgreSQL-backed transaction repository.
 * Handles all database operations for transactions.
 */
export class TransactionRepository implements ITransactionRepository {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Persists a new transaction record.
     */
    async create(transactionData: CreateTransactionData): Promise<TransactionRecord> {
        const { id, orderId, amount, currency, cardNumber, status } = transactionData;
        const result = await this.pool.query(
            `INSERT INTO transactions (id, order_id, amount, currency, card_number, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [id, orderId, amount, currency, cardNumber, status],
        );
        return this.mapRow(result.rows[0]);
    }

    /**
     * Finds a transaction by its internal UUID.
     */
    async findById(transactionId: string): Promise<TransactionRecord | null> {
        const result = await this.pool.query(
            'SELECT * FROM transactions WHERE id = $1',
            [transactionId],
        );
        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    }

    /**
     * Finds a transaction by its PSP-assigned transaction ID.
     */
    async findByPspTransactionId(pspTransactionId: string): Promise<TransactionRecord | null> {
        const result = await this.pool.query(
            'SELECT * FROM transactions WHERE psp_transaction_id = $1',
            [pspTransactionId],
        );
        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    }

    /**
     * Updates the transaction status and optional extra fields.
     */
    async updateStatus(
        transactionId: string,
        status: TransactionStatus,
        extraFields: UpdateExtraFields = {},
    ): Promise<TransactionRecord> {
        const setClauses = ['status = $2', 'updated_at = NOW()'];
        const values: (string | number)[] = [transactionId, status];
        let parameterIndex = 3;

        if (extraFields.pspTransactionId !== undefined) {
            setClauses.push(`psp_transaction_id = $${parameterIndex}`);
            values.push(extraFields.pspTransactionId);
            parameterIndex++;
        }

        if (extraFields.finalAmount !== undefined) {
            setClauses.push(`final_amount = $${parameterIndex}`);
            values.push(extraFields.finalAmount);
            parameterIndex++;
        }

        const result = await this.pool.query(
            `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
            values,
        );
        return this.mapRow(result.rows[0]);
    }

    /**
     * Atomically finds a transaction by PSP ID with a row lock (SELECT ... FOR UPDATE)
     * inside a database transaction. Returns the locked transaction along with
     * scoped updateStatus, commit, and rollback functions.
     */
    async findAndLockByPspTransactionId(pspTransactionId: string) {
        const client = await this.pool.connect();
        await client.query('BEGIN');

        try {
            const result = await client.query(
                'SELECT * FROM transactions WHERE psp_transaction_id = $1 FOR UPDATE',
                [pspTransactionId],
            );

            const transaction = result.rows[0] ? this.mapRow(result.rows[0]) : null;

            return {
                transaction,
                updateStatus: async (status: TransactionStatus, extraFields: UpdateExtraFields = {}) => {
                    if (!transaction) {
                        throw new Error('Cannot update: transaction not found');
                    }

                    const setClauses = ['status = $2', 'updated_at = NOW()'];
                    const values: (string | number)[] = [transaction.id, status];
                    let parameterIndex = 3;

                    if (extraFields.pspTransactionId !== undefined) {
                        setClauses.push(`psp_transaction_id = $${parameterIndex}`);
                        values.push(extraFields.pspTransactionId);
                        parameterIndex++;
                    }

                    if (extraFields.finalAmount !== undefined) {
                        setClauses.push(`final_amount = $${parameterIndex}`);
                        values.push(extraFields.finalAmount);
                        parameterIndex++;
                    }

                    const updateResult = await client.query(
                        `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
                        values,
                    );
                    return this.mapRow(updateResult.rows[0]);
                },
                commit: async () => {
                    await client.query('COMMIT');
                    client.release();
                },
                rollback: async () => {
                    await client.query('ROLLBACK');
                    client.release();
                },
            };
        } catch (error) {
            await client.query('ROLLBACK');
            client.release();
            throw error;
        }
    }

    /**
     * Maps a database row to a domain-friendly TransactionRecord with camelCase keys.
     */
    private mapRow(row: Record<string, unknown>): TransactionRecord {
        return {
            id: row.id as string,
            orderId: row.order_id as string,
            amount: row.amount as number,
            currency: row.currency as string,
            cardNumber: row.card_number as string,
            status: row.status as TransactionStatus,
            pspTransactionId: row.psp_transaction_id as string | null,
            finalAmount: row.final_amount as number | null,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }
}
