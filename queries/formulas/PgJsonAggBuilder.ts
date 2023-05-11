// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { PgFunctionBuilder } from "./PgFunctionBuilder";
import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";

/**
 * This generates formulas like `array_agg(formula)`
 */
export class PgJsonAggBuilder extends PgFunctionBuilder {
    public constructor () {
        super('json_agg');
    }

    public static create (builder: QueryBuilder) : PgJsonAggBuilder {
        const f = new PgJsonAggBuilder();
        f.setFormulaFromQueryBuilder(builder);
        return f;
    }

}
