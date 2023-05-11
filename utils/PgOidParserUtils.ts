// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { LogService } from "../../core/LogService";
import { LogLevel } from "../../core/types/LogLevel";
import { startsWith } from "../../core/functions/startsWith";
import { endsWith } from "../../core/functions/endsWith";
import { trim } from "../../core/functions/trim";
import { indexOf } from "../../core/functions/indexOf";
import { trimStart } from "../../core/functions/trimStart";

const LOG = LogService.createLogger('PgOidParserUtils');

export class PgOidParserUtils {

    public static setLogLevel (logLevel: LogLevel) : void {
        LOG.setLogLevel(logLevel);
    }

    public static parseRecord (
        value: string
    ) : (string|null)[] {

        let step : number = 0;

        const origValue = value;
        value = trim(value);
        LOG.debug(`step ${++step}: value = ${value}`);

        if ( !(startsWith(value, '(') && endsWith(value, ')')) ) {
            throw new TypeError(`Did not look like a record string: "${value}"`);
        }
        value = trim(value.substring(1, value.length-1));
        LOG.debug(`step ${++step}: value = ${value}`);

        let ret : (string|null)[] = [];

        while (value.length) {

            if (startsWith(value, '"')) {
                value = value.substring(1);
                LOG.debug(`step ${++step}: value = ${value}`);

                let part = '';

                let index = indexOf(value, '"');
                if ( index < 0 ) {
                    throw new TypeError(`Could not find ending double quote from "${origValue}"`);
                }

                part = value.substring(0, index);
                value = value.substring(index + 1);
                LOG.debug(`step ${++step}: value = ${value}`);
                while ( startsWith(value, '"') ) {
                    value = value.substring(1);
                    LOG.debug(`step ${++step}: value = ${value}`);
                    index = indexOf(value, '"');
                    if ( index < 0 ) {
                        throw new TypeError(`Could not find ending double quote from "${origValue}"`);
                    }
                    part += '"' + value.substring(0, index);
                    value = trimStart(value.substring(index + 1));
                    LOG.debug(`step ${++step}: value = ${value}`);
                }

                LOG.debug(`Adding 1:  ${JSON.stringify(part)}`);
                ret.push(part);

                value = trimStart(value);

                if (startsWith(value, ",")) {
                    value = trimStart(value.substring(1));
                    if (value.length === 0) {
                        LOG.debug(`Adding 1 last null`);
                        ret.push(null);
                    }
                }

            } else if (startsWith(value, ',')) {

                LOG.debug(`Adding null`);
                ret.push(null);
                value = trimStart(value.substring(1));
                LOG.debug(`step ${++step}: value = ${value}`);

                if (value.length === 0) {
                    LOG.debug(`Adding last null`);
                    ret.push(null);
                }

            } else {
                let index = indexOf(value, ',');
                if (index >= 0) {
                    const item = trim(value.substring(0, index));
                    LOG.debug(`Adding 2: ${JSON.stringify(item)}`);
                    ret.push(item);
                    value = trimStart(value.substring(index+1));
                    LOG.debug(`step ${++step}: value = ${value}`);

                    if (value.length === 0) {
                        LOG.debug(`Adding 2 last null`);
                        ret.push(null);
                    }

                } else {
                    const item = trim(value);
                    if (item?.length === 0) {
                        LOG.debug(`Adding 3 null`);
                        ret.push(null);
                    } else {
                        LOG.debug(`Adding 3: ${JSON.stringify(item)}`);
                        ret.push(item);
                        value = '';
                        LOG.debug(`step ${++step}: value = ${value}`);
                    }
                }
            }

        }

        return ret;
    }

}

