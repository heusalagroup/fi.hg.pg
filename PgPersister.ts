// Copyright (c) 2022-2023. Heusala Group Oy. All rights reserved.
// Copyright (c) 2020-2021. Sendanor. All rights reserved.

import { first } from "../core/functions/first";
import { map } from "../core/functions/map";
import { find } from "../core/functions/find";
import { has } from "../core/functions/has";
import { Pool, PoolClient, PoolConfig, QueryResult, types } from "pg";
import { EntityMetadata } from "../core/data/types/EntityMetadata";
import { Persister } from "../core/data/types/Persister";
import { Entity, EntityIdTypes } from "../core/data/Entity";
import { EntityUtils } from "../core/data/utils/EntityUtils";
import { KeyValuePairs } from "../core/data/types/KeyValuePairs";
import { LogService } from "../core/LogService";
import { LogLevel } from "../core/types/LogLevel";
import { isSafeInteger } from "../core/types/Number";
import { PersisterMetadataManager } from "../core/data/persisters/types/PersisterMetadataManager";
import { PersisterMetadataManagerImpl } from "../core/data/persisters/types/PersisterMetadataManagerImpl";
import { PgEntitySelectQueryBuilder } from "../core/data/query/pg/select/PgEntitySelectQueryBuilder";
import { PgQueryUtils } from "../core/data/query/pg/utils/PgQueryUtils";
import { PgOid } from "../core/data/persisters/pg/types/PgOid";
import { PgOidParserUtils } from "../core/data/persisters/pg/utils/PgOidParserUtils";
import { Sort } from "../core/data/Sort";
import { Where } from "../core/data/Where";
import { PgEntityDeleteQueryBuilder } from "../core/data/query/pg/delete/PgEntityDeleteQueryBuilder";
import { isArray } from "../core/types/Array";
import { PgEntityUpdateQueryBuilder } from "../core/data/query/pg/update/PgEntityUpdateQueryBuilder";
import { PgAndChainBuilder } from "../core/data/query/pg/formulas/PgAndChainBuilder";
import { PgEntityInsertQueryBuilder } from "../core/data/query/pg/insert/PgEntityInsertQueryBuilder";
import { PersisterType } from "../core/data/persisters/types/PersisterType";
import { TableFieldInfoCallback, TableFieldInfoResponse } from "../core/data/query/sql/select/EntitySelectQueryBuilder";
import { parseIsoDateStringWithMilliseconds } from "../core/types/Date";
import { PersisterEntityManagerImpl } from "../core/data/persisters/types/PersisterEntityManagerImpl";
import { PersisterEntityManager } from "../core/data/persisters/types/PersisterEntityManager";
import { EntityCallbackUtils } from "../core/data/utils/EntityCallbackUtils";
import { EntityCallbackType } from "../core/data/types/EntityCallbackType";
import { startsWith } from "../core/functions/startsWith";

const LOG = LogService.createLogger('PgPersister');

// FIXME: Make this lazy so that it doesn't happen if the PgPersister has not been used
//        This could also be set on Pool only. Better to change there.
types.setTypeParser(PgOid.RECORD as number, PgOidParserUtils.parseRecord);

// Override timestamp conversion to force timestamp to be inserted in UTC
types.setTypeParser(1114, (str) => {
    const utcStr = `${str}Z`;
    return parseIsoDateStringWithMilliseconds( new Date(utcStr) , true);
});

/**
 * This persister implements entity store over PostgreSQL database.
 *
 * @see {@link Persister}
 */
export class PgPersister implements Persister {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
        PgEntityInsertQueryBuilder.setLogLevel(level);
        EntityUtils.setLogLevel(level);
    }

    private _pool: Pool | undefined;
    private readonly _metadataManager : PersisterMetadataManager;
    private readonly _entityManager : PersisterEntityManager;
    private readonly _tablePrefix : string;
    private readonly _fetchTableInfo : TableFieldInfoCallback;

    public constructor (
        host: string | undefined = undefined,
        user: string | undefined = undefined,
        password: string | undefined = undefined,
        database: string | undefined = undefined,
        ssl : boolean | undefined = undefined,
        tablePrefix: string = '',
        applicationName: string | undefined = undefined,
        connectionTimeoutMillis : number | undefined = undefined,
        idleTimeoutMillis : number | undefined = undefined,
        maxClients: number = 100,
        allowExitOnIdle : boolean | undefined = undefined,
        queryTimeout: number | undefined = undefined,
        statementTimeout: number | undefined = undefined,
        idleInTransactionSessionTimeout: number | undefined = undefined,
        port : number | undefined = undefined,
    ) {
        const config : PoolConfig = host && startsWith(host, 'postgresql://') ? ({
            connectionString: host
        }) : ({
            ...(host !== undefined ? { host } : {}),
            ...(user !== undefined ? { user } : {}),
            ...(password !== undefined ? { password } : {}),
            ...(database !== undefined ? { database } : {}),
            ...(port !== undefined ? { port } : {}),
            ...(ssl !== undefined ? {ssl} : {}),
            ...(applicationName !== undefined ? {application_name: applicationName} : {}),
            ...(queryTimeout !== undefined ? {query_timeout: queryTimeout} : {}),
            ...(statementTimeout !== undefined ? {statement_timeout: statementTimeout} : {}),
            ...(connectionTimeoutMillis !== undefined ? {connectionTimeoutMillis} : {}),
            ...(idleInTransactionSessionTimeout !== undefined ? {idle_in_transaction_session_timeout: idleInTransactionSessionTimeout} : {}),
            ...(idleTimeoutMillis !== undefined ? {idleTimeoutMillis} : {}),
            ...(maxClients !== undefined ? {max: maxClients} : {}),
            ...(allowExitOnIdle !== undefined ? {allowExitOnIdle} : {}),
        });
        this._tablePrefix = tablePrefix;
        this._pool = new Pool( config );
        this._pool.on('error', (err/*, client*/) => {
            LOG.error(`Unexpected error on idle client: `, err);
        })
        this._metadataManager = new PersisterMetadataManagerImpl();
        this._entityManager = PersisterEntityManagerImpl.create();
        this._fetchTableInfo = (tableName: string) : TableFieldInfoResponse => {
            const mappedMetadata = this._metadataManager.getMetadataByTable(tableName);
            if (!mappedMetadata) throw new TypeError(`Could not find metadata for table "${tableName}"`);
            const mappedFields = mappedMetadata.fields;
            const temporalProperties = mappedMetadata.temporalProperties;
            return [mappedFields, temporalProperties];
        };
    }

    /**
     * @inheritDoc
     * @see {@link Persister.getPersisterType}
     */
    public getPersisterType (): PersisterType {
        return PersisterType.POSTGRESQL;
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
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

    /**
     * @inheritDoc
     * @see {@link Persister.setupEntityMetadata}
     * @see {@link PersisterMetadataManager.setupEntityMetadata}
     */
    public setupEntityMetadata (metadata: EntityMetadata) : void {
        this._metadataManager.setupEntityMetadata(metadata);
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async count<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        where    : Where | undefined
    ): Promise<number> {
        return await this._transaction(
            async (connection) => this._count(connection, metadata, where)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async existsBy<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        where    : Where
    ): Promise<boolean> {
        return await this._transaction(
            async (connection) => this._existsBy(connection, metadata, where)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async deleteAll<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        where    : Where | undefined,
    ): Promise<void> {
        return await this._transaction(
            async (connection) => this._deleteAll(connection, metadata, where)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.findAll}
     */
    public async findAll<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        where    : Where | undefined,
        sort     : Sort | undefined
    ): Promise<T[]> {
        return await this._transaction(
            async (connection) => this._findAll(connection, metadata, where, sort)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async findBy<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        where    : Where,
        sort     : Sort | undefined
    ): Promise<T | undefined> {
        return await this._transaction(
            async (connection) => this._findBy(connection, metadata, where, sort)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async insert<T extends Entity, ID extends EntityIdTypes> (
        metadata : EntityMetadata,
        entities : T | readonly T[],
    ): Promise<T> {
        return await this._transaction(
            async (connection) => this._insert(connection, metadata, entities)
        );
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    public async update<T extends Entity, ID extends EntityIdTypes> (
        metadata: EntityMetadata,
        entity: T,
    ): Promise<T> {
        return await this._transaction(
            async (connection) => this._update(connection, metadata, entity)
        );
    }


    protected async _transaction (callback: (connection : PoolClient) => Promise<any>) {
        let connection : PoolClient | undefined = undefined;
        let returnValue : any = undefined;
        try {
            connection = await this._getConnection();
            await this._beginTransaction(connection);
            returnValue = await callback(connection);
            await this._commitTransaction(connection);
        } catch (err) {
            if (connection) {
                try {
                    await this._rollbackTransaction(connection);
                } catch (err) {
                    LOG.warn(`Warning! Failed to rollback transaction: `, err);
                }
            }
            throw err;
        } finally {
            if (connection) {
                try {
                    connection.release();
                } catch (err) {
                    LOG.warn(`Warning! Failed to release connection: `, err);
                }
            }
        }
        return returnValue;
    }

    protected async _beginTransaction (connection : PoolClient) : Promise<void> {
        await connection.query('BEGIN');
    }

    protected async _commitTransaction (connection : PoolClient) : Promise<void> {
        await connection.query('COMMIT');
    }

    protected async _rollbackTransaction (connection : PoolClient) : Promise<void> {
        await connection.query('ROLLBACK');
    }

    protected async _getConnection () : Promise<PoolClient> {
        const pool = this._pool;
        if (!pool) throw new TypeError(`The pool was not initialized`);
        return pool.connect();
    }


    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _count<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        where    : Where | undefined
    ): Promise<number> {

        const {tableName, fields, temporalProperties} = metadata;
        const builder = PgEntitySelectQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);
        builder.includeFormulaByString('COUNT(*)', 'count');
        if (where !== undefined) builder.setWhereFromQueryBuilder( builder.buildAnd(where, tableName, fields, temporalProperties) );
        const [queryString, queryValues] = builder.build();

        LOG.debug(`count: queryString = `, queryString);
        LOG.debug(`count: queryValues = `, queryValues);

        const result = await this._query(connection, queryString, queryValues);
        if (!result) throw new TypeError('Could not get result for PgPersister.countByCondition');
        LOG.debug(`count: result = `, result);
        const rows = result.rows;
        LOG.debug(`count: rows = `, rows);
        if (!rows) throw new TypeError('Could not get result rows for PgPersister.countByCondition');
        const row = first(rows);
        LOG.debug(`count: row = `, row);
        if (!row) throw new TypeError('Could not get result row for PgPersister.countByCondition');
        const count = row.count;
        LOG.debug(`count: count = `, count);
        if (!count) throw new TypeError('Could not read count for PgPersister.countByCondition');
        const parsedCount = parseInt(count, 10);
        if (!isSafeInteger(parsedCount)) throw new TypeError(`Could not read count for PgPersister.countByCondition`);
        return parsedCount;
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _existsBy<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        where    : Where
    ): Promise<boolean> {
        const {tableName, fields, temporalProperties} = metadata;
        const builder = PgEntitySelectQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);
        builder.includeFormulaByString('COUNT(*) >= 1', 'exists');
        builder.setWhereFromQueryBuilder( builder.buildAnd(where, tableName, fields, temporalProperties) );
        const [queryString, queryValues] = builder.build();

        const result = await this._query(connection, queryString, queryValues);
        if (!result) throw new TypeError('Could not get result for PgPersister.countByCondition');
        LOG.debug(`count: result = `, result);
        const rows = result.rows;
        LOG.debug(`count: rows = `, rows);
        if (!rows) throw new TypeError('Could not get result rows for PgPersister.countByCondition');
        const row = first(rows);
        LOG.debug(`count: row = `, row);
        if (!row) throw new TypeError('Could not get result row for PgPersister.countByCondition');
        const exists = row.exists;
        LOG.debug(`count: exists = `, exists);
        return exists;

    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _deleteAll<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        where    : Where | undefined,
    ): Promise<void> {
        let entities : T[] = [];
        const {tableName, fields, temporalProperties, callbacks, idPropertyName } = metadata;
        const hasPreRemoveCallbacks = EntityCallbackUtils.hasCallbacks(callbacks, EntityCallbackType.PRE_REMOVE);
        const hasPostRemoveCallbacks = EntityCallbackUtils.hasCallbacks(callbacks, EntityCallbackType.POST_REMOVE);

        if ( hasPreRemoveCallbacks || hasPostRemoveCallbacks ) {
            entities = await this._findAll<T, ID>(connection, metadata, where, undefined);
        }

        if (hasPreRemoveCallbacks) {
            await EntityCallbackUtils.runPreRemoveCallbacks(
                entities,
                callbacks
            );
        }

        if ( !hasPreRemoveCallbacks && !hasPostRemoveCallbacks ) {

            LOG.debug( `deleteAll: tableName = `, tableName );
            const builder = new PgEntityDeleteQueryBuilder();
            builder.setTablePrefix( this._tablePrefix );
            builder.setTableName( tableName );
            if ( where !== undefined ) {
                LOG.debug( `deleteAll: where = `, where );
                builder.setWhereFromQueryBuilder( builder.buildAnd( where, tableName, fields, temporalProperties ) );
            }
            const [ queryString, queryValues ] = builder.build();
            LOG.debug( `deleteAll: queryString = `, queryString );
            await this._query( connection, queryString, queryValues );

        } else if (entities?.length) {

            const builder = new PgEntityDeleteQueryBuilder();
            builder.setTablePrefix( this._tablePrefix );
            builder.setTableName( tableName );
            builder.setWhereFromQueryBuilder(
                builder.buildAnd(
                    Where.propertyListEquals(
                        idPropertyName,
                        map(entities, (item) => (item as any)[idPropertyName] )
                    ),
                    tableName,
                    fields,
                    temporalProperties
                )
            );
            const [queryString, queryValues] = builder.build();
            await this._query(connection, queryString, queryValues);

            if (hasPostRemoveCallbacks) {
                await EntityCallbackUtils.runPostRemoveCallbacks(
                    entities,
                    callbacks
                );
            }

        }

    }

    /**
     * @inheritDoc
     * @see {@link Persister.findAll}
     */
    private async _findAll<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        where    : Where | undefined,
        sort     : Sort | undefined
    ): Promise<T[]> {
        LOG.debug(`findAll: `, metadata, where, sort);
        const { tableName, fields, oneToManyRelations, manyToOneRelations, temporalProperties, callbacks } = metadata;
        LOG.debug(`tableName = "${tableName}"`);
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = PgEntitySelectQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);
        if (sort !== undefined) {
            builder.setOrderByTableFields(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeEntityFields(tableName, fields, temporalProperties);
        builder.setOneToManyRelations(oneToManyRelations, this._fetchTableInfo);
        builder.setManyToOneRelations(manyToOneRelations, this._fetchTableInfo, fields, temporalProperties);
        if (where !== undefined) builder.setWhereFromQueryBuilder( builder.buildAnd(where, tableName, fields, temporalProperties) );
        const [queryString, queryValues] = builder.build();
        const result = await this._query(connection, queryString, queryValues);
        const resultEntity = this._toEntityArray(result, metadata);
        await EntityCallbackUtils.runPostLoadCallbacks(
            resultEntity,
            callbacks
        );
        return resultEntity as unknown as T[];
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _findBy<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        where    : Where,
        sort     : Sort | undefined
    ): Promise<T | undefined> {
        const { tableName, fields, oneToManyRelations, manyToOneRelations, temporalProperties, callbacks } = metadata;
        const mainIdColumnName : string = EntityUtils.getIdColumnName(metadata);
        const builder = PgEntitySelectQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);
        if (sort) {
            builder.setOrderByTableFields(sort, tableName, fields);
        }
        builder.setGroupByColumn(mainIdColumnName);
        builder.includeEntityFields(tableName, fields, temporalProperties);
        builder.setOneToManyRelations(oneToManyRelations, this._fetchTableInfo);
        builder.setManyToOneRelations(manyToOneRelations, this._fetchTableInfo, fields, temporalProperties);
        if (where !== undefined) builder.setWhereFromQueryBuilder( builder.buildAnd(where, tableName, fields, temporalProperties) );
        const [queryString, queryValues] = builder.build();
        const result = await this._query(connection, queryString, queryValues);
        const resultEntity = this._toFirstEntityOrUndefined<T, ID>(result, metadata);
        if (resultEntity) {
            await EntityCallbackUtils.runPostLoadCallbacks(
                [resultEntity],
                callbacks
            );
        }
        return resultEntity;
    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _insert<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata : EntityMetadata,
        entities : T | readonly T[],
    ): Promise<T> {
        LOG.debug(`insert: entities = `, entities, metadata);
        if ( !isArray(entities) ) {
            entities = [entities];
        }
        if ( entities?.length < 1 ) {
            throw new TypeError(`No entities provided. You need to provide at least one entity to insert.`);
        }
        // Make sure all of our entities have the same metadata
        if (!EntityUtils.areEntitiesSameType(entities)) {
            throw new TypeError(`Insert can only insert entities of the same time. There were some entities with different metadata than provided.`);
        }

        const { tableName, fields, temporalProperties, idPropertyName, callbacks } = metadata;

        await EntityCallbackUtils.runPrePersistCallbacks(
            entities,
            callbacks
        );

        LOG.debug(`insert: table= `, tableName);

        const builder = PgEntityInsertQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);

        builder.appendEntityList(
            entities,
            fields,
            temporalProperties,
            [idPropertyName]
        );

        const [ queryString, values ] = builder.build();

        LOG.debug(`insert: query = `, queryString, values);
        const result = await this._query(connection, queryString, values);
        LOG.debug(`insert: result = `, result);
        const resultEntity = this._toFirstEntityOrFail<T, ID>(result, metadata);

        await EntityCallbackUtils.runPostLoadCallbacks(
            [resultEntity],
            callbacks
        );

        // FIXME: Only single item is returned even if multiple are added {@see https://github.com/heusalagroup/fi.hg.core/issues/72}
        await EntityCallbackUtils.runPostPersistCallbacks(
            [resultEntity],
            callbacks
        );

        return resultEntity;

    }

    /**
     * @inheritDoc
     * @see {@link Persister.destroy}
     */
    private async _update<T extends Entity, ID extends EntityIdTypes> (
        connection : PoolClient,
        metadata: EntityMetadata,
        entity: T,
    ): Promise<T> {
        const { tableName, fields, temporalProperties, idPropertyName, callbacks } = metadata;

        const idField = find(fields, item => item.propertyName === idPropertyName);
        if (!idField) throw new TypeError(`Could not find id field using property "${idPropertyName}"`);
        const idColumnName = idField.columnName;
        if (!idColumnName) throw new TypeError(`Could not find id column using property "${idPropertyName}"`);

        const entityId = has(entity, idPropertyName) ? (entity as any)[idPropertyName] : undefined;
        if (!entityId) throw new TypeError(`Could not find entity id column using property "${idPropertyName}"`);

        const updateFields = this._entityManager.getChangedFields(
            entity,
            fields
        );

        if (updateFields.length === 0) {

            // FIXME: We probably should call PreUpdate in case that the object
            //  in the database has changed by someone else?

            LOG.debug(`Entity did not any updatable properties changed. Saved nothing.`);
            const item : T | undefined = await this._findBy(
                connection,
                metadata,
                Where.propertyEquals(idPropertyName, entityId),
                Sort.by(idPropertyName)
            );
            if (!item) {
                throw new TypeError(`Entity was not stored in this persister for ID: ${entityId}`);
            }

            await EntityCallbackUtils.runPostUpdateCallbacks(
                [item],
                callbacks
            );
            return item;
        }

        await EntityCallbackUtils.runPreUpdateCallbacks(
            [entity],
            callbacks
        );

        const builder = PgEntityUpdateQueryBuilder.create();
        builder.setTablePrefix(this._tablePrefix);
        builder.setTableName(tableName);

        builder.appendEntity(
            entity,
            updateFields,
            temporalProperties,
            [idPropertyName]
        );

        const where = PgAndChainBuilder.create();
        where.setColumnEquals(this._tablePrefix+tableName, idColumnName, entityId);
        builder.setWhereFromQueryBuilder(where);

        // builder.setEntities(metadata, entities);
        const [ queryString, queryValues ] = builder.build();

        const result = await this._query(connection, queryString, queryValues);
        const loadedEntity = this._toFirstEntityOrFail<T, ID>(result, metadata);

        await EntityCallbackUtils.runPostLoadCallbacks(
            [loadedEntity],
            callbacks
        );

        await EntityCallbackUtils.runPostUpdateCallbacks(
            [loadedEntity],
            callbacks
        );
        return loadedEntity;
    }



    /**
     * Performs the actual SQL query.
     *
     * @param connection
     * @param query The query as a string with parameter placeholders
     * @param values The values for parameter placeholders
     * @private
     */
    private async _query (
        connection : PoolClient,
        query: string,
        values: readonly any[]
    ) : Promise<QueryResult> {
        query = PgQueryUtils.parametizeQuery(query);
        LOG.debug(`Query "${query}" with values: `, values);
        try {
            // FIXME: The upstream library wants writable array. This might be error.
            return await connection.query(query, values as any[]);
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
        result: QueryResult,
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
                return this._toEntity<T, ID>(row, metadata);
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
        result: QueryResult,
        metadata: EntityMetadata
    ) : T | undefined {
        if ( !result ) throw new TypeError(`Result was not defined: ${result}`);

        if ( result.fields !== undefined ) LOG.debug(`result.fields = `, result.fields);
        if ( result.oid !== undefined ) LOG.debug(`result.oid = `, result.oid);
        if ( result.command !== undefined ) LOG.debug(`result.command = `, result.command);
        if ( result.rowCount !== undefined ) LOG.debug(`result.rowCount = `, result.rowCount);

        const rows = result.rows;
        if (!rows) throw new TypeError(`Result rows was not defined: ${rows}`);
        const row = first(rows);
        if (!row) return undefined;
        LOG.debug(`_toFirstEntityOrUndefined: row = `, row);
        return this._toEntity<T, ID>(row, metadata);
    }

    /**
     * Turns the result set into single entity, and fails if it cannot do that.
     *
     * @param result
     * @param metadata
     * @private
     */
    private _toFirstEntityOrFail<T extends Entity, ID extends EntityIdTypes> (
        result: QueryResult,
        metadata: EntityMetadata
    ) : T {
        const item = this._toFirstEntityOrUndefined<T, ID>(result, metadata);
        if (item === undefined) throw new TypeError(`Result was not found`);
        LOG.debug(`_toFirstEntityOrFail: item = `, item);
        return item;
    }

    private _toEntity<T extends Entity, ID extends EntityIdTypes> (
        row      : KeyValuePairs,
        metadata : EntityMetadata
    ) : T {
        const entity = EntityUtils.toEntity<T, ID>(row, metadata, this._metadataManager);
        this._entityManager.saveLastEntityState(entity);
        return entity;
    }

}
