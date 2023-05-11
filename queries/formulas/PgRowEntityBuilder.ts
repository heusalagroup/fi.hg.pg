// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { EntityField } from "../../../core/data/types/EntityField";
import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { PgRowBuilder } from "./PgRowBuilder";
import { EntityFieldType } from "../../../core/data/types/EntityFieldType";

/**
 * This generates formulas like `ROW(table.column[, table2.column2[, ...]])`
 * but can configure it just by using the table name and entity field array.
 */
export class PgRowEntityBuilder implements QueryBuilder {

    private readonly _jsonBuilder : PgRowBuilder;

    public constructor (
    ) {
        this._jsonBuilder = new PgRowBuilder();
    }

    public setEntityFieldsFromTable (
        tableName : string,
        fields : readonly EntityField[]
    ) {
        fields.forEach(
            (field: EntityField) => {
                const {columnName, fieldType} = field;
                if (fieldType !== EntityFieldType.JOINED_ENTITY) {
                    this._jsonBuilder.setTableColumn(tableName, columnName);
                }
            }
        );
    }

    public static create (
        tableName : string,
        fields    : readonly EntityField[]
    ) : PgRowEntityBuilder {
        const f = new PgRowEntityBuilder();
        f.setEntityFieldsFromTable(tableName, fields);
        return f;
    }

    public build (): [ string, any[] ] {
        return [ this.buildQueryString(), this.buildQueryValues() ];
    }

    public buildQueryString (): string {
        return this._jsonBuilder.buildQueryString();
    }

    public buildQueryValues (): any[] {
        return this._jsonBuilder.buildQueryValues();
    }

    public getQueryValueFactories (): (() => any)[] {
        return this._jsonBuilder.getQueryValueFactories();
    }

}
