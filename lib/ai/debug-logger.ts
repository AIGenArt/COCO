// Debug Logger for AI Integration Testing

export class DebugLogger {
  private static enabled = process.env.NODE_ENV === 'development';
  
  static log(category: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[COCO AI ${category}]`;
    
    console.log(`${prefix} ${message}`);
    if (data) {
      console.log(`${prefix} Data:`, data);
    }
  }
  
  static error(category: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[COCO AI ${category} ERROR]`;
    
    console.error(`${prefix} ${message}`);
    if (error) {
      console.error(`${prefix} Error:`, error);
    }
  }
  
  static success(category: string, message: string) {
    if (!this.enabled) return;
    
    const prefix = `[COCO AI ${category} ✓]`;
    console.log(`${prefix} ${message}`);
  }
}
