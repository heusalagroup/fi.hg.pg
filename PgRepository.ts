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
        this._insertQuery = insertQuery;
        this._listQuery = listQuery;
        this._getQuery = getQuery;
        this._setQuery = setQuery;
        this._deleteQuery = deleteQuery;
    }

    public async createItem (data: T, members?: readonly string[]): Promise<RepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async deleteAll (): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async deleteById (id: string): Promise<RepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async deleteByIdList (list: readonly string[]): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async deleteByList (list: RepositoryEntry<T>[]): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async findById (id: string, includeMembers?: boolean): Promise<RepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

    public async findByIdAndUpdate (id: string, item: T): Promise<RepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async findByProperty (propertyName: string, propertyValue: any): Promise<RepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

    public async getAll (): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async getAllByProperty (propertyName: string, propertyValue: any): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async getSome (idList: readonly string[]): Promise<RepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async inviteToItem (id: string, members: readonly string[]): Promise<void> {
        throw new Error(`Not implemented`);
    }

    public isRepositoryEntryList (list: any): list is RepositoryEntry<T>[] {
        throw new Error(`Not implemented`);
    }

    public async subscribeToItem (id: string): Promise<void> {
        throw new Error(`Not implemented`);
    }

    public async update (id: string, data: T): Promise<RepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async updateOrCreateItem (item: T): Promise<RepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async waitById (id: string, includeMembers?: boolean, timeout?: number): Promise<RepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

}
