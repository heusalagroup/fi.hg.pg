// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { SimpleStoredRepositoryItem } from "../../core/simpleRepository/types/SimpleStoredRepositoryItem";
import { SimpleRepository } from "../../core/simpleRepository/types/SimpleRepository";
import { SimpleRepositoryEntry } from "../../core/simpleRepository/types/SimpleRepositoryEntry";

export class PgRepository <T extends SimpleStoredRepositoryItem> implements SimpleRepository<T> {

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

    public async createItem (data: T, members?: readonly string[]): Promise<SimpleRepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async deleteAll (): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async deleteById (id: string): Promise<SimpleRepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async deleteByIdList (list: readonly string[]): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async deleteByList (list: SimpleRepositoryEntry<T>[]): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async findById (id: string, includeMembers?: boolean): Promise<SimpleRepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

    public async findByIdAndUpdate (id: string, item: T): Promise<SimpleRepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async findByProperty (propertyName: string, propertyValue: any): Promise<SimpleRepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

    public async getAll (): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async getAllByProperty (propertyName: string, propertyValue: any): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async getSome (idList: readonly string[]): Promise<SimpleRepositoryEntry<T>[]> {
        throw new Error(`Not implemented`);
    }

    public async inviteToItem (id: string, members: readonly string[]): Promise<void> {
        throw new Error(`Not implemented`);
    }

    public isRepositoryEntryList (list: any): list is SimpleRepositoryEntry<T>[] {
        throw new Error(`Not implemented`);
    }

    public async subscribeToItem (id: string): Promise<void> {
        throw new Error(`Not implemented`);
    }

    public async update (id: string, data: T): Promise<SimpleRepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async updateOrCreateItem (item: T): Promise<SimpleRepositoryEntry<T>> {
        throw new Error(`Not implemented`);
    }

    public async waitById (id: string, includeMembers?: boolean, timeout?: number): Promise<SimpleRepositoryEntry<T> | undefined> {
        throw new Error(`Not implemented`);
    }

}
