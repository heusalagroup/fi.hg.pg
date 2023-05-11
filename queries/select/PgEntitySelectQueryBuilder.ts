// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { PgSelectQueryBuilder } from "./PgSelectQueryBuilder";
import { SelectQueryBuilder } from "../../../core/data/persisters/types/SelectQueryBuilder";
import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { EntityField } from "../../../core/data/types/EntityField";
import { EntityRelationOneToMany } from "../../../core/data/types/EntityRelationOneToMany";
import { PersisterMetadataManager } from "../../../core/data/persisters/types/PersisterMetadataManager";
import { forEach } from "../../../core/functions/forEach";
import { EntityRelationManyToOne } from "../../../core/data/types/EntityRelationManyToOne";
import { find } from "../../../core/functions/find";
import { EntityFieldType } from "../../../core/data/types/EntityFieldType";
import { PgJsonAggBuilder } from "../formulas/PgJsonAggBuilder";
import { PgJsonBuildObjectEntityBuilder } from "../formulas/PgJsonBuildObjectEntityBuilder";
import { PgJsonIndexBuilder } from "../formulas/PgJsonIndexBuilder";
import { Sort } from "../../../core/data/Sort";

export class PgEntitySelectQueryBuilder implements SelectQueryBuilder {

    private _builder : PgSelectQueryBuilder;

    public constructor () {
        this._builder = new PgSelectQueryBuilder();
    }

    public build (): [ string, any[] ] {
        return this._builder.build();
    }

    public buildQueryString (): string {
        return this._builder.buildQueryString();
    }

    public buildQueryValues (): any[] {
        return this._builder.buildQueryValues();
    }

    public getQueryValueFactories (): (() => any)[] {
        return this._builder.getQueryValueFactories();
    }

    public includeAllColumnsFromTable (tableName: string): void {
        return this._builder.includeAllColumnsFromTable(tableName);
    }

    public includeColumnFromQueryBuilder (builder: QueryBuilder, asColumnName: string): void {
        return this._builder.includeColumnFromQueryBuilder(builder, asColumnName);
    }

    public includeFormulaByString (formula: string, asColumnName: string): void {
        return this._builder.includeFormulaByString(formula, asColumnName);
    }

    public leftJoinTable (fromTableName: string, fromColumnName: string, sourceTableName: string, sourceColumnName: string): void {
        return this._builder.leftJoinTable(fromTableName, fromColumnName, sourceTableName, sourceColumnName);
    }

    public setFromTable (tableName: string): void {
        return this._builder.setFromTable(tableName);
    }

    public getShortFromTable (): string {
        return this._builder.getShortFromTable();
    }

    public getCompleteFromTable (): string {
        return this._builder.getCompleteFromTable();
    }

    public setGroupByColumn (columnName: string): void {
        return this._builder.setGroupByColumn(columnName);
    }

    public setOrderBy (
        sort      : Sort,
        tableName : string,
        fields    : readonly EntityField[]
    ): void {
        return this._builder.setOrderByTableFields(sort, tableName, fields);
    }

    public getGroupByColumn (): string {
        return this._builder.getGroupByColumn();
    }

    public setTablePrefix (prefix: string): void {
        return this._builder.setTablePrefix(prefix);
    }

    public getTablePrefix (): string {
        return this._builder.getTablePrefix();
    }

    public getCompleteTableName (tableName: string): string {
        return this._builder.getCompleteTableName(tableName);
    }

    public setWhereFromQueryBuilder (builder: QueryBuilder): void {
        return this._builder.setWhereFromQueryBuilder(builder);
    }

    /**
     * Append a relation from one entity to many, e.g. the property will be an
     * array.
     *
     * The PostgreSQL query will look like this:
     *
     * ```
     * SELECT
     *   "carts".*,
     *   array_agg(ROW("cart_items"."cart_item_id", "cart_items"."cart_id", "cart_items"."cart_item_name")) AS "cartItems"
     * FROM carts
     * LEFT JOIN "cart_items" ON "carts"."cart_id" = "cart_items"."cart_id"
     * GROUP BY "carts"."cart_id";
     * ```
     *
     * @param propertyName
     * @param fields
     * @param targetTableName
     * @param targetColumnName
     * @param sourceTableName
     * @param sourceColumnName
     */
    public setOneToMany (
        propertyName: string,
        fields: readonly EntityField[],
        targetTableName : string,
        targetColumnName : string,
        sourceTableName  : string,
        sourceColumnName : string
    ) {
        this._builder.includeColumnFromQueryBuilder(
            PgJsonAggBuilder.create(
                PgJsonBuildObjectEntityBuilder.create(
                    this.getCompleteTableName(targetTableName),
                    fields
                )
            ),
            propertyName
        );
        this._builder.leftJoinTable(
            targetTableName, targetColumnName,
            sourceTableName, sourceColumnName
        );
    }

    /**
     * Append a relation from many entities to one, e.g. the property will be
     * single entity object.
     *
     * The PostgreSQL query will look like this:
     * ```
     * SELECT
     *   "cart_items".*,
     *   json_agg(json_build_object('cart_id', "carts"."cart_id", 'cart_name', "carts"."cart_name"))->0 AS cart
     * FROM "cart_items"
     * LEFT JOIN "carts" ON "carts"."cart_id" = "cart_items"."cart_id"
     * GROUP BY "cart_items"."cart_item_id";
     * ```
     *
     * ***Note*** that this only works if the "carts"."carts_id" is unique!
     * There will be multiple entities returned if not.
     *
     * @param propertyName
     * @param fields
     * @param targetTableName
     * @param targetColumnName
     * @param sourceTableName
     * @param sourceColumnName
     */
    public setManyToOne (
        propertyName: string,
        fields: readonly EntityField[],
        targetTableName : string,
        targetColumnName : string,
        sourceTableName  : string,
        sourceColumnName : string
    ) {
        this._builder.includeColumnFromQueryBuilder(
            PgJsonIndexBuilder.create(
                PgJsonAggBuilder.create(
                    PgJsonBuildObjectEntityBuilder.create(
                        this.getCompleteTableName(targetTableName), fields
                    )
                ),
                0
            ),
            propertyName
        );
        this._builder.leftJoinTable(
            targetTableName, targetColumnName,
            sourceTableName, sourceColumnName
        );
    }

    public setOneToManyRelations (
        relations: readonly EntityRelationOneToMany[],
        metadataManager: PersisterMetadataManager
    ) {
        forEach(
            relations,
            (relation: EntityRelationOneToMany) : void => {
                const { propertyName } = relation;
                const mappedTable = relation?.mappedTable;
                if (!mappedTable) throw new TypeError(`The relation "${propertyName}" did not have table defined`);
                const mappedMetadata = metadataManager.getMetadataByTable(mappedTable);
                if (!mappedMetadata) throw new TypeError(`Could not find metadata for property "${propertyName}"`);
                this.setOneToMany(
                    propertyName,
                    mappedMetadata.fields,
                    mappedTable, this.getGroupByColumn(),
                    this.getShortFromTable(), this.getGroupByColumn()
                );
            }
        );
    }

    public setManyToOneRelations (
        relations: readonly EntityRelationManyToOne[],
        metadataManager: PersisterMetadataManager,
        fields: readonly EntityField[]
    ) {
        forEach(
            relations,
            (relation: EntityRelationManyToOne) : void => {
                const { propertyName } = relation;
                const mappedTable = relation?.mappedTable;
                if (!mappedTable) throw new TypeError(`The relation "${propertyName}" did not have table defined`);
                const mappedMetadata = metadataManager.getMetadataByTable(mappedTable);
                if (!mappedMetadata) throw new TypeError(`Could not find metadata for property "${propertyName}"`);
                const mappedField : EntityField | undefined = find(fields, (field) => field?.propertyName === propertyName && field?.fieldType === EntityFieldType.JOINED_ENTITY);
                if (!mappedField) throw new TypeError(`Could not find field definition for property "${propertyName}"`);
                const mappedColumnName : string = mappedField.columnName;
                if (!mappedColumnName) throw new TypeError(`Could not find column name for property "${propertyName}"`);
                this.setManyToOne(
                    propertyName,
                    mappedMetadata.fields,
                    mappedTable, mappedColumnName,
                    this.getShortFromTable(), mappedColumnName
                );
            }
        );
    }

}
