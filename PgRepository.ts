// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { StoredRepositoryItem } from "../core/simpleRepository/types/StoredRepositoryItem";
import { Repository } from "../core/simpleRepository/types/Repository";
import { RepositoryEntry } from "../core/simpleRepository/types/RepositoryEntry";

export class PgRepository <T extends StoredRepositoryItem> implements Repository<T> {

    private _insertQuery : string;
    private _listQuery   : string;
    private _getQuery    : string;
    private _setQuery    : string;
    private _deleteQuery : string;

    public constructor (
        insertQuery: string,
        listQuery : string,
        getQuery : string,
        setQuery : string,
        deleteQuery : string
    ) {

    }

    public createItem (data: T, members?: readonly string[]): Promise<RepositoryEntry<T>> {
        return Promise.resolve(undefined);
    }

    public deleteAll (): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public deleteById (id: string): Promise<RepositoryEntry<T>> {
        return Promise.resolve(undefined);
    }

    public deleteByIdList (list: readonly string[]): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public deleteByList (list: RepositoryEntry<T>[]): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public findById (id: string, includeMembers?: boolean): Promise<RepositoryEntry<T> | undefined> {
        return Promise.resolve(undefined);
    }

    public findByIdAndUpdate (id: string, item: T): Promise<RepositoryEntry<T>> {
        return Promise.resolve(undefined);
    }

    public findByProperty (propertyName: string, propertyValue: any): Promise<RepositoryEntry<T> | undefined> {
        return Promise.resolve(undefined);
    }

    public getAll (): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public getAllByProperty (propertyName: string, propertyValue: any): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public getSome (idList: readonly string[]): Promise<RepositoryEntry<T>[]> {
        return Promise.resolve([]);
    }

    public inviteToItem (id: string, members: readonly string[]): Promise<void> {
        return Promise.resolve(undefined);
    }

    public isRepositoryEntryList (list: any): list is RepositoryEntry<T>[] {
        return undefined;
    }

    public subscribeToItem (id: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    public update (id: string, data: T): Promise<RepositoryEntry<T>> {
        return Promise.resolve(undefined);
    }

    public updateOrCreateItem (item: T): Promise<RepositoryEntry<T>> {
        return Promise.resolve(undefined);
    }

    public waitById (id: string, includeMembers?: boolean, timeout?: number): Promise<RepositoryEntry<T> | undefined> {
        return Promise.resolve(undefined);
    }

}
