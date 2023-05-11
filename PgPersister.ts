// Copyright (c) 2022-2023. Heusala Group Oy. All rights reserved.
// Copyright (c) 2020-2021. Sendanor. All rights reserved.

import { Pool, QueryResult, types } from "pg";
import { EntityMetadata } from "../core/data/types/EntityMetadata";
import { Persister } from "../core/data/types/Persister";
import { Entity, EntityIdTypes } from "../core/data/Entity";
import { EntityUtils } from "../core/data/utils/EntityUtils";
import { map } from "../core/functions/map";
import { EntityField } from "../core/data/types/EntityField";
import { KeyValuePairs } from "../core/data/types/KeyValuePairs";
import { first } from "../core/functions/first";
import { reduce } from "../core/functions/reduce";
import { LogService } from "../core/LogService";
import { LogLevel } from "../core/types/LogLevel";
import { isSafeInteger } from "../core/types/Number";
import { PersisterMetadataManager } from "../core/data/persisters/types/PersisterMetadataManager";
import { PersisterMetadataManagerImpl } from "../core/data/persisters/types/PersisterMetadataManagerImpl";
import { EntityFieldType } from "../core/data/types/EntityFieldType";
import { PgEntitySelectQueryBuilder } from "./queries/select/PgEntitySelectQueryBuilder";
import { PgAndBuilder } from "./queries/formulas/PgAndBuilder";
import { PgQueryUtils } from "./utils/PgQueryUtils";
import { PgOid } from "./types/PgOid";
import { PgOidParserUtils } from "./utils/PgOidParserUtils";
import { Sort } from "../core/data/Sort";

const LOG = LogService.createLogger('PgPersister');

// FIXME: Make this lazy so that it doesn't happen if the PgPersister has not been used
types.setTypeParser(PgOid.RECORD as number, PgOidParserUtils.parseRecord);

/**
 * This persister implements entity store over PostgreSQL database.
 */
export class PgPersister implements Persister {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    private _pool: Pool | undefined;
    private readonly _metadataManager : PersisterMetadataManager;
    private readonly _tablePrefix : string;

    public constructor (
        host: string,
        user: string,
        password: string,
        database: string,
        ssl : boolean | undefined = undefined,
        tablePrefix: string = '',
        applicationName: string | undefined = undefined,
        connectionTimeoutMillis : number | undefined = undefined,
        idleTimeoutMillis : number | undefined = undefined,
        maxClients: number = 100,
        allowExitOnIdle : boolean | undefined = undefined,
        queryTimeout: number | undefined = undefined,
        statementTimeout: number | undefined = undefined,
        idleInTransactionSessionTimeout: number | undefined = undefined
    ) {
        this._tablePrefix = tablePrefix;
        this._pool = new Pool(
            {
                host,
                user,
                password,
                database,
                ...(ssl !== undefined ? {ssl} : {}),
                ...(applicationName !== undefined ? {application_name: applicationName} : {}),
                ...(queryTimeout !== undefined ? {query_timeout: queryTimeout} : {}),
                ...(statementTimeout !== undefined ? {statement_timeout: statementTimeout} : {}),
                ...(connectionTimeoutMillis !== undefined ? {connectionTimeoutMillis} : {}),
                ...(idleInTransactionSessionTimeout !== undefined ? {idle_in_transaction_session_timeout: idleInTransactionSessionTimeout} : {}),
                ...(idleTimeoutMillis !== undefined ? {idleTimeoutMillis} : {}),
                ...(maxClients !== undefined ? {max: maxClients} : {}),
                ...(allowExitOnIdle !== undefined ? {allowExitOnIdle} : {}),
            }
        );
        this._pool.on('error', (err, client) => {
            LOG.error(`Unexpected error on idle client: `, err);
        })
        this._metadataManager = new PersisterMetadataManagerImpl();

    }

    public destroy () {
        if (this._pool) {
            this._pool.removeAllListeners('error');
            // FIXME: Is there something we should do to tell the pool to destroy itself?
            this._pool.end().catch((err) => {
                LOG.error(`Error closing pool: ${err}`);
            });
            this._pool = undefined;
        }
    }

    public setupEntityMetadata (metadata: EntityMetadata) : void {
        this._metadataManager.setupEntityMetadata(metadata);
    }

    public async insert<T extends Entity, ID extends EntityIdTypes> (entity: T | readonly T[], metadata: EntityMetadata): Promise<T> {
        const {tableName} = metadata;
        const fields = metadata.fields.filter((fld) => !this._isIdField(fld, metadata) && fld.fieldType !== EntityFieldType.JOINED_ENTITY);
        const colNames = map(fields, (col) => col.columnName).join(",");
        const values = map(fields, (col) => col.propertyName).map((p) => (entity as any)[p]);
        const placeholders = Array.from({length: fields.length}, (_, i) => i + 1)
                                  .map((i) => `$${i}`)
                                  .reduce((prev, curr) => `${prev},${curr}`);
        const insert = `INSERT INTO ${this._tablePrefix}${tableName}(${colNames})
                        VALUES (${placeholders}) RETURNING *`;
        LOG.debug(`insert query = `, insert, values);
        const result = await this._query(insert, values);
        return this._toFirstEntityOrFail<T, ID>(result, metadata);
    }

    public async update<T extends Entity, ID extends EntityIdTypes> (entity: T, metadata: EntityMetadata): Promise<T> {
        const {tableName} = metadata;
        const idColName = this._getIdColumnName(metadata);
        const id = this._getId(entity, metadata);
        const fields = metadata.fields.filter((fld) => !this._isIdField(fld, metadata) && fld.fieldType !== EntityFieldType.JOINED_ENTITY);
        const setters = map(fields, (fld, idx) => `${fld.columnName}=$${idx + 2}`).reduce((prev, curr) => `${prev},${curr}`);
        const values = [ id ].concat( map(fields, (col) => (entity as any)[col.propertyName]) );
        const update = `UPDATE ${this._tablePrefix}${tableName}
                        SET ${setters}
                        WHERE ${idColName} = $1 RETURNING *`;
        const result = await this._query(update, values);
        return this._toFirstEntityOrFail<T, ID>(result, metadata);
    }

    public async delete<T extends Entity, ID extends EntityIdTypes> (entity: T, metadata: EntityMetadata): Promise<void> {
        const {tableName} = metadata;
        const idColName = this._getIdColumnName(metadata);
        const id = this._getId(entity, metadata);
        const sql = `DELETE
                     FROM ${this._tablePrefix}${tableName}
                     WHERE ${idColName} = $1 RETURNING *`;
        await this._query(sql, [ id ]);
    }

    public async findAll<T extends Entity, ID extends EntityIdTypes> (
        metadata: EntityMetadata,
        sort     : Sort | undefined
    ): Promise<T[]> {
        LOG.debug(`findAll: metadata = `, metadata);
        const {tableName, fields, oneToManyRelations, manyToOneRelations} = metadata;
        LOG.debug(`findAll: tableName = `, tableName, fields);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = new PgEntitySelectQueryBuilder();
        builder.setTablePrefix(this._tablePrefix);
        builder.setFromTable(tableName);
        if (sort) {
            builder.setOrderBy(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeAllColumnsFromTable(tableName);
        builder.setOneToManyRelations(oneToManyRelations, this._metadataManager);
        builder.setManyToOneRelations(manyToOneRelations, this._metadataManager, fields);
        const [queryString, queryValues] = builder.build();
        LOG.debug(`findAll: queryString = `, queryString, queryValues);
        const result = await this._query(queryString, queryValues);
        return this._toEntityArray(result, metadata);
    }

    public async findAllById<T extends Entity, ID extends EntityIdTypes> (
        ids: readonly ID[],
        metadata: EntityMetadata,
        sort     : Sort | undefined
    ): Promise<T[]> {

        LOG.debug(`findAllById: ids = `, ids);
        if (ids.length <= 0) throw new TypeError('At least one ID must be selected. Array was empty.');
        LOG.debug(`findAllById: metadata = `, metadata);

        const {tableName, fields, oneToManyRelations, manyToOneRelations} = metadata;
        LOG.debug(`findAllById: tableName = `, tableName, fields);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = new PgEntitySelectQueryBuilder();
        builder.setTablePrefix(this._tablePrefix);
        builder.setFromTable(tableName);
        if (sort) {
            builder.setOrderBy(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeAllColumnsFromTable(tableName);
        builder.setOneToManyRelations(oneToManyRelations, this._metadataManager);
        builder.setManyToOneRelations(manyToOneRelations, this._metadataManager, fields);
        const where = new PgAndBuilder();
        where.setColumnInList(builder.getCompleteTableName(tableName), mainIdColumnName, ids);
        builder.setWhereFromQueryBuilder(where);

        const [queryString, queryValues] = builder.build();

        const result = await this._query(queryString, queryValues);
        return this._toEntityArray<T, ID>(result, metadata);
    }

    public async findById<T extends Entity, ID extends EntityIdTypes> (
        id: ID,
        metadata : EntityMetadata,
        sort     : Sort | undefined
    ): Promise<T | undefined> {
        LOG.debug(`findById: id = `, id);
        LOG.debug(`findById: metadata = `, metadata);
        const {tableName, fields, oneToManyRelations, manyToOneRelations} = metadata;
        LOG.debug(`findById: tableName = `, tableName, fields);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = new PgEntitySelectQueryBuilder();
        builder.setTablePrefix(this._tablePrefix);
        builder.setFromTable(tableName);
        if (sort) {
            builder.setOrderBy(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeAllColumnsFromTable(tableName);
        builder.setOneToManyRelations(oneToManyRelations, this._metadataManager);
        builder.setManyToOneRelations(manyToOneRelations, this._metadataManager, fields);
        const where = new PgAndBuilder();
        where.setColumnEquals(builder.getCompleteTableName(tableName), mainIdColumnName, id);
        builder.setWhereFromQueryBuilder(where);
        const [queryString, queryValues] = builder.build();
        const result = await this._query(queryString, queryValues);
        return this._toFirstEntityOrUndefined<T, ID>(result, metadata);
    }

    public async findAllByProperty<T extends Entity, ID extends EntityIdTypes> (
        property: string,
        value: any,
        metadata: EntityMetadata,
        sort     : Sort | undefined
    ): Promise<T[]> {
        LOG.debug(`findAllByProperty: property = `, property);
        LOG.debug(`findAllByProperty: metadata = `, metadata);
        const {tableName, fields, oneToManyRelations, manyToOneRelations} = metadata;
        const columnName = this._getColumnName(property, fields);
        LOG.debug(`findAllByProperty: tableName = `, tableName, fields);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = new PgEntitySelectQueryBuilder();
        builder.setTablePrefix(this._tablePrefix);
        builder.setFromTable(tableName);
        if (sort) {
            builder.setOrderBy(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeAllColumnsFromTable(tableName);
        builder.setOneToManyRelations(oneToManyRelations, this._metadataManager);
        builder.setManyToOneRelations(manyToOneRelations, this._metadataManager, fields);
        const where = new PgAndBuilder();
        where.setColumnEquals(builder.getCompleteTableName(tableName), columnName, value);
        builder.setWhereFromQueryBuilder(where);
        const [queryString, queryValues] = builder.build();
        const result = await this._query(queryString, queryValues);
        return this._toEntityArray<T, ID>(result, metadata);
    }

    private _getColumnName (propertyName: string, fields: readonly EntityField[]): string {
        return fields.find((x) => x.propertyName === propertyName)?.columnName || "";
    }

    private _getIdColumnName (metadata: EntityMetadata) {
        return this._getColumnName(metadata.idPropertyName, metadata.fields);
    }

    private _getId (entity: KeyValuePairs, metadata: EntityMetadata) {
        return entity[metadata.idPropertyName];
    }

    private _isIdField (field: EntityField, metadata: EntityMetadata) {
        return field.propertyName === metadata.idPropertyName;
    }

    public async count<T extends Entity, ID extends EntityIdTypes> (metadata: EntityMetadata): Promise<number> {
        const {tableName} = metadata;
        const sql = `SELECT COUNT(*) as count FROM ${this._tablePrefix}${tableName}`;
        const result = await this._query(sql, []);
        if (!result) throw new TypeError('Could not get result for PgPersister.countByProperty');
        LOG.debug(`count: result = `, result);
        const rows = result.rows;
        LOG.debug(`count: rows = `, rows);
        if (!rows) throw new TypeError('Could not get result rows for PgPersister.countByProperty');
        const row = first(rows);
        LOG.debug(`count: row = `, row);
        if (!row) throw new TypeError('Could not get result row for PgPersister.countByProperty');
        const count = row.count;
        LOG.debug(`count: count = `, count);
        if (!count) throw new TypeError('Could not read count for PgPersister.countByProperty');
        const parsedCount = parseInt(count, 10);
        if (!isSafeInteger(parsedCount)) throw new TypeError(`Could not read count for PgPersister.countByProperty`);
        return parsedCount;
    }

    public async countByProperty<T extends Entity, ID extends EntityIdTypes> (property: string, value: any, metadata: EntityMetadata): Promise<number> {
        const {tableName} = metadata;
        const columnName = EntityUtils.getColumnName(property, metadata.fields);
        const sql = `SELECT COUNT(*) as count FROM ${this._tablePrefix}${tableName} WHERE ${columnName} = $1`;
        const result = await this._query(sql, [value]);
        LOG.debug(`countByProperty: result = `, result);
        if (!result) throw new TypeError('Could not get result for PgPersister.countByProperty');
        const rows = result.rows;
        LOG.debug(`count: rows = `, rows);
        if (!rows) throw new TypeError('Could not get result rows for PgPersister.countByProperty');
        const row = first(rows);
        LOG.debug(`count: row = `, row);
        if (!row) throw new TypeError('Could not get result row for PgPersister.countByProperty');
        const count = row.count;
        LOG.debug(`count: count = `, count);
        if (!count) throw new TypeError('Could not read count for PgPersister.countByProperty');
        const parsedCount = parseInt(count, 10);
        if (!isSafeInteger(parsedCount)) throw new TypeError(`Could not read count for PgPersister.countByProperty`);
        return parsedCount;
    }

    public async deleteAll<T extends Entity, ID extends EntityIdTypes> (metadata: EntityMetadata): Promise<void> {
        const {tableName} = metadata;
        const sql = `DELETE FROM ${this._tablePrefix}${tableName}`;
        await this._query(sql, []);
    }

    /**
     *
     * @param ids
     * @param metadata
     * @FIXME This could be improved as single query
     */
    public async deleteAllById<T extends Entity, ID extends EntityIdTypes> (ids: readonly ID[], metadata: EntityMetadata): Promise<void> {
        await reduce(
            ids,
            async (prev: Promise<void>, id: ID) => {
                await prev;
                await this.deleteById(id, metadata);
            },
            Promise.resolve()
        );
    }

    public async deleteAllByProperty<T extends Entity, ID extends EntityIdTypes> (
        property: string,
        value: any,
        metadata: EntityMetadata
    ): Promise<void> {
        const {tableName} = metadata;
        const columnName = EntityUtils.getColumnName(property, metadata.fields);
        const select = `DELETE
                        FROM ${this._tablePrefix}${tableName}
                        WHERE ${columnName} = $1`;
        await this._query(select, [ value ]);
    }

    public async deleteById<T extends Entity, ID extends EntityIdTypes> (id: ID, metadata: EntityMetadata): Promise<void> {
        const {tableName} = metadata;
        const idColumnName = this._getIdColumnName(metadata);
        const query = `DELETE
                        FROM ${this._tablePrefix}${tableName}
                        WHERE ${idColumnName} = $1`;
        await this._query(query, [ id ]);
    }

    public async existsByProperty<T extends Entity, ID extends EntityIdTypes> (property: string, value: any, metadata: EntityMetadata): Promise<boolean> {
        const count = await this.countByProperty(property, value, metadata);
        return count >= 1;
    }

    public async findByProperty<T extends Entity, ID extends EntityIdTypes> (
        property: string,
        value: any,
        metadata: EntityMetadata,
        sort     : Sort | undefined
    ): Promise<T | undefined> {
        const columnName = EntityUtils.getColumnName(property, metadata.fields);

        LOG.debug(`findByProperty: columnName = `, columnName);
        LOG.debug(`findByProperty: metadata = `, metadata);
        const {tableName, fields, oneToManyRelations, manyToOneRelations} = metadata;
        LOG.debug(`findByProperty: tableName = `, tableName, fields);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = new PgEntitySelectQueryBuilder();
        builder.setTablePrefix(this._tablePrefix);
        builder.setFromTable(tableName);
        if (sort) {
            builder.setOrderBy(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeAllColumnsFromTable(tableName);
        builder.setOneToManyRelations(oneToManyRelations, this._metadataManager);
        builder.setManyToOneRelations(manyToOneRelations, this._metadataManager, fields);
        const where = new PgAndBuilder();
        where.setColumnEquals(builder.getCompleteTableName(tableName), columnName, value);
        builder.setWhereFromQueryBuilder(where);
        const [queryString, queryValues] = builder.build();
        const result = await this._query(queryString, queryValues);
        return this._toFirstEntityOrUndefined<T, ID>(result, metadata);
    }

    private async _query (
        query: string,
        values: any[]
    ) : Promise<QueryResult<any>> {
        query = PgQueryUtils.parametizeQuery(query);
        LOG.debug(`Query "${query}" with values: `, values);
        const pool = this._pool;
        if (!pool) throw new TypeError(`The persister has been destroyed`);
        try {
            return await pool.query(query, values);
        } catch (err) {
            LOG.debug(`Query failed: `, query, values);
            throw TypeError(`Query failed: "${query}": ${err}`);
        }
    }

    /**
     * Turns the result set into an array of entities.
     *
     * @param result
     * @param metadata
     * @private
     */
    private _toEntityArray<T extends Entity, ID extends EntityIdTypes> (
        result: QueryResult<any>,
        metadata: EntityMetadata
    ) : T[] {
        if (!result) throw new TypeError(`Illegal result from query`);

        if ( result.fields !== undefined ) LOG.debug(`result.fields = `, result.fields);
        if ( result.oid !== undefined ) LOG.debug(`result.oid = `, result.oid);
        if ( result.command !== undefined ) LOG.debug(`result.command = `, result.command);
        if ( result.rowCount !== undefined ) LOG.debug(`result.rowCount = `, result.rowCount);

        if (!result.rows) throw new TypeError(`Illegal result rows from query`);
        LOG.debug(`_toEntityArray: result.rows = `, result.rows);
        return map(
            result.rows,
            (row: any) => {
                if (!row) throw new TypeError(`Unexpected illegal row: ${row}`);
                return EntityUtils.toEntity<T, ID>(row, metadata, this._metadataManager);
            }
        );
    }

    /**
     * Turns the result set into single entity, and returns `undefined` if
     * no entity was found.
     *
     * @param result
     * @param metadata
     * @private
     */
    private _toFirstEntityOrUndefined<T extends Entity, ID extends EntityIdTypes> (
        result: QueryResult<any>,
        metadata: EntityMetadata
    ) : T | undefined {
        if (!result) throw new TypeError(`Result was not defined: ${result}`);

        if ( result.fields !== undefined ) LOG.debug(`result.fields = `, result.fields);
        if ( result.oid !== undefined ) LOG.debug(`result.oid = `, result.oid);
        if ( result.command !== undefined ) LOG.debug(`result.command = `, result.command);
        if ( result.rowCount !== undefined ) LOG.debug(`result.rowCount = `, result.rowCount);

        const rows = result.rows;
        if (!rows) throw new TypeError(`Result rows was not defined: ${rows}`);
        const row = first(rows);
        if (!row) return undefined;
        LOG.debug(`_toFirstEntityOrUndefined: row = `, row);
        return EntityUtils.toEntity<T, ID>(row, metadata, this._metadataManager);
    }

    /**
     * Turns the result set into single entity, and fails if cannot do that.
     *
     * @param result
     * @param metadata
     * @private
     */
    private _toFirstEntityOrFail<T extends Entity, ID extends EntityIdTypes> (
        result: QueryResult<any>,
        metadata: EntityMetadata
    ) : T {
        const item = this._toFirstEntityOrUndefined<T, ID>(result, metadata);
        if (item === undefined) throw new TypeError(`Result was not found`);
        LOG.debug(`_toFirstEntityOrFail: item = `, item);
        return item;
    }

}
