// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { PgFunctionBuilder } from "./PgFunctionBuilder";
import { PgArgumentListBuilder } from "./PgArgumentList";

/**
 * This generates formulas like `ROW(table.column[, table2.column2, ...])`
 */
export class PgRowBuilder extends PgFunctionBuilder {

    private readonly _arguments : PgArgumentListBuilder;

    public constructor () {
        super('ROW');
        this._arguments = new PgArgumentListBuilder();
        this.setFormulaFromQueryBuilder(this._arguments);
    }

    /**
     *
     * @param tableName The table name from where to read the value
     * @param columnName The column name in the table where to read the value
     */
    public setTableColumn (
        tableName: string,
        columnName: string
    ) {
        this._arguments.setTableColumn(tableName, columnName);
    }

    public static create () : PgRowBuilder {
        return new PgRowBuilder();
    }

}
