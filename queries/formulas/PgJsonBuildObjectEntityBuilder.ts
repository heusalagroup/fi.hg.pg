// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { EntityField } from "../../../core/data/types/EntityField";
import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { PgRowBuilder } from "./PgRowBuilder";
import { EntityFieldType } from "../../../core/data/types/EntityFieldType";
import { PgJsonBuildObjectBuilder } from "./PgJsonBuildObjectBuilder";

/**
 * This generates formulas like `json_build_object(property, table.column[, property2, table2.column2[, ...]])`
 * but can configure it just by using the table name and entity field array.
 */
export class PgJsonBuildObjectEntityBuilder implements QueryBuilder {

    private readonly _builder : PgJsonBuildObjectBuilder;

    public constructor (
    ) {
        this._builder = new PgJsonBuildObjectBuilder();
    }

    public static create (
        tableName : string,
        fields    : readonly EntityField[]
    ) : PgJsonBuildObjectEntityBuilder {
        const f = new PgJsonBuildObjectEntityBuilder();
        f.setEntityFieldsFromTable(tableName, fields);
        return f;
    }

    public setEntityFieldsFromTable (
        tableName : string,
        fields : readonly EntityField[]
    ) {
        fields.forEach(
            (field: EntityField) => {
                const {columnName, fieldType, columnDefinition} = field;
                if (fieldType !== EntityFieldType.JOINED_ENTITY) {
                    if (columnDefinition === "BIGINT") {
                        this._builder.setPropertyAsText(columnName, tableName, columnName);
                    } else {
                        this._builder.setProperty(columnName, tableName, columnName);
                    }
                }
            }
        );
    }

    public build (): [ string, any[] ] {
        return [ this.buildQueryString(), this.buildQueryValues() ];
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

}
