export interface FilterDefinition {
  column: string;
  operator: 'Equals' | 'NotEquals' | 'GreaterThan' | 'GreaterThanOrEqual' | 'LessThan' | 'LessThanOrEqual' | 'Contains' | 'StartsWith' | 'EndsWith' | 'In' | 'Between' | 'IsBlank' | 'IsNotBlank';
  value: string;
  value2?: string;
  isEnabled: boolean;
}

export interface HierarchyDefinition {
  column: string;
  alias?: string;
  sortOrder?: 'Ascending' | 'Descending';
  subtotal?: boolean;
  sortByMetric?: string;
  format?: string;
  appendTotalWord?: boolean;
}

export interface ValueMetricDefinition {
  column: string;
  alias?: string;
  aggregation: 'SUM' | 'COUNT' | 'COUNT_DISTINCT' | 'AVERAGE' | 'AVG' | 'MIN' | 'MAX';
  format?: string;
  decimalPlaces?: number;
  isAlreadyPercent?: boolean;
  formulaModifier?: string;
  isEditable?: boolean;
  showTotal?: boolean;
}

export interface CalculatedFieldDefinition {
  name: string;
  alias?: string;
  formula: string;
  format?: string;
  decimalPlaces?: number;
  isAlreadyPercent?: boolean;
  isEditable?: boolean;
  showTotal?: boolean;
}

export interface ColumnStyle {
  headerTextColor?: string;
  headerBgColor?: string;
  cellTextColor?: string;
  cellBgColor?: string;
  alwaysParentheses?: boolean;
  headerParentheses?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  showTotal?: boolean;
  wrapHeader?: boolean;
}

export interface HeaderGroupDefinition {
  id: string;
  label: string;
  columnKeys: string[];
  textColor?: string;
  bgColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
}

export interface PivotTemplate {
  templateName: string;
  version: string;
  description: string;
  rowHierarchyHeader?: string;
  filters: FilterDefinition[];
  rowHierarchy: HierarchyDefinition[];
  columnDimensions: HierarchyDefinition[];
  values: ValueMetricDefinition[];
  calculatedFields: CalculatedFieldDefinition[];
  columnStyles?: Record<string, ColumnStyle>;
  headerGroups?: HeaderGroupDefinition[];
  columnOrder?: string[];
  wrapHeaders?: boolean;
}

export interface PivotHierarchyNode {
  id: string;
  level: number;
  isGrandTotal: boolean;
  isSubtotal: boolean;
  isLeaf: boolean;
  isExpanded: boolean;
  groupField: string;
  groupValue: string;
  displayText: string;
  fullPath: string;
  parentId?: string;
  children: PivotHierarchyNode[];
  numericMetrics: Record<string, number>;
  calculatedValues: Record<string, any>;
  editableOverrides: Record<string, number>;
  formattedValues: Record<string, string>;
}

export interface PivotCraftProject {
  format: 'PivotCraft_Workbook';
  version: '1.0';
  savedAt: string;
  datasetName?: string;
  template: PivotTemplate;
  cellOverrides: Record<string, Record<string, number>>;
  columnWidths?: Record<string, number>;
  expansionState?: string[];
  rowCount: number;
  columns: Array<{ columnName: string; dataType: string }>;
  parquetData?: string;
  rawCsvText?: string;
}