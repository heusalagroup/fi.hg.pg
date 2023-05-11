// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { PgFunctionBuilder } from "./PgFunctionBuilder";
import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";

/**
 * This generates formulas like `array_agg(formula)`
 */
export class PgArrayAggBuilder extends PgFunctionBuilder {

    public constructor () {
        super('array_agg');
    }

    public static create (builder: QueryBuilder) : PgArrayAggBuilder {
        const f = new PgArrayAggBuilder();
        f.setFormulaFromQueryBuilder(builder);
        return f;
    }

}
