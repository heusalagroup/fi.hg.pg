// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { explainEnum, isEnum, parseEnum, stringifyEnum } from "../../core/types/Enum";

export enum PgOid {
    RECORD = 2249,
    ARRAY_OF_RECORD = 2287,
    BIGINT = 20
}

export function isPgOid (value: unknown) : value is PgOid {
    return isEnum(PgOid, value);
}

export function explainPgOid (value : unknown) : string {
    return explainEnum("PgOid", PgOid, isPgOid, value);
}

export function stringifyPgOid (value : PgOid) : string {
    return stringifyEnum(PgOid, value);
}

export function parsePgOid (value: any) : PgOid | undefined {
    return parseEnum(PgOid, value) as PgOid | undefined;
}
