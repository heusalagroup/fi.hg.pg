// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { replaceAll } from "../../core/functions/replaceAll";
import { replace } from "../../core/functions/replace";

export class PgQueryUtils {

    /**
     * Returns the placeholder for values
     *
     * This will be `$#` which will be later changed to `$1`, `$2` etc.
     */
    static getValuePlaceholder () : string {
        return '$#';
    }

    static quoteTableName (value: string) : string {
        // FIXME: Implement better implementation
        return `"${value}"`;
    }

    static quoteColumnName (value: string) : string {
        // FIXME: Implement better implementation
        return `"${value}"`;
    }

    static quoteTableAndColumn (tableName: string, columnName: string) : string {
        return `${PgQueryUtils.quoteTableName(tableName)}.${PgQueryUtils.quoteColumnName(columnName)}`;
    }

    static quoteString (tableName: string) : string {
        // FIXME: Implement better implementation
        return `"${tableName}"`;
    }

    /**
     * Converts any parameter placeholder in a string to `$N` where `N` is 1, 2, 3, etc.
     *
     * E.g. a string like `"SELECT * FROM table WHERE foo = $# AND bar = $#"`
     * will be changed to: `"SELECT * FROM table WHERE foo = $1 AND bar = $2"`
     *
     * @param query
     * @see {@link PgQueryUtils.getValuePlaceholder}
     */
    static parametizeQuery (query: string) : string {
        const placeholder = this.getValuePlaceholder();
        let i = 1;
        while ( query.indexOf(placeholder) >= 0 ) {
            query = query.replace(placeholder, () => `$${i++}`);
        }
        return query;
    }

}
