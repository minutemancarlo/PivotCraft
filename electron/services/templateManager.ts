import fs from 'fs';
import { PivotTemplate } from '../../src/types/pivot.js';

export class TemplateManager {
  public async loadTemplate(filePath: string): Promise<PivotTemplate> {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return {
      templateName: parsed.templateName || 'Custom Pivot',
      version: parsed.version || '2.0',
      description: parsed.description || '',
      rowHierarchyHeader: parsed.rowHierarchyHeader || 'Row Hierarchy / Group',
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      rowHierarchy: Array.isArray(parsed.rowHierarchy) ? parsed.rowHierarchy : [],
      columnDimensions: Array.isArray(parsed.columnDimensions) ? parsed.columnDimensions : [],
      values: Array.isArray(parsed.values) ? parsed.values : [],
      calculatedFields: Array.isArray(parsed.calculatedFields) ? parsed.calculatedFields : [],
      columnStyles: parsed.columnStyles && typeof parsed.columnStyles === 'object' ? parsed.columnStyles : {},
      headerGroups: Array.isArray(parsed.headerGroups) ? parsed.headerGroups : [],
      columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [],
      wrapHeaders: !!parsed.wrapHeaders,
    };
  }

  public async saveTemplate(template: PivotTemplate, filePath: string): Promise<void> {
    const sanitized: PivotTemplate = {
      templateName: template.templateName || 'Custom Pivot',
      version: template.version || '2.0',
      description: template.description || '',
      rowHierarchyHeader: template.rowHierarchyHeader || 'Row Hierarchy / Group',
      filters: Array.isArray(template.filters) ? template.filters : [],
      rowHierarchy: Array.isArray(template.rowHierarchy) ? template.rowHierarchy : [],
      columnDimensions: Array.isArray(template.columnDimensions) ? template.columnDimensions : [],
      values: Array.isArray(template.values) ? template.values : [],
      calculatedFields: Array.isArray(template.calculatedFields) ? template.calculatedFields : [],
      columnStyles: template.columnStyles && typeof template.columnStyles === 'object' ? template.columnStyles : {},
      headerGroups: Array.isArray(template.headerGroups) ? template.headerGroups : [],
      columnOrder: Array.isArray(template.columnOrder) ? template.columnOrder : [],
      wrapHeaders: !!template.wrapHeaders,
    };
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
  }

  public static createDefaultTemplate(): PivotTemplate {
    return {
      templateName: 'Custom Pivot',
      version: '2.0',
      description: 'Custom user pivot table.',
      rowHierarchyHeader: 'Row Hierarchy / Group',
      filters: [],
      rowHierarchy: [],
      columnDimensions: [],
      values: [],
      calculatedFields: [],
      columnStyles: {},
      headerGroups: [],
      columnOrder: [],
      wrapHeaders: false,
    };
  }
}