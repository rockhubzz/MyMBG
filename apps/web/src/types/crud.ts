export interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
  hasDefaultValue: boolean;
  isPrimaryKey: boolean;
}

export interface EntityDefinition {
  logicalName: string;
  tableName: string;
  primaryKey: string;
  columns: ColumnDefinition[];
}

export interface PagedResult {
  page: number;
  pageSize: number;
  total: number;
  items: Record<string, unknown>[];
}
