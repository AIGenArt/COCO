'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  Database, 
  FileCode, 
  FolderTree, 
  Shield,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PlanningViewProps {
  blueprint?: {
    description: string;
    database?: {
      tables: Array<{
        name: string;
        columns: string[];
      }>;
      policies: string[];
    };
    fileStructure?: Array<{
      path: string;
      description: string;
    }>;
    features?: string[];
    security?: string[];
  };
  onApprove?: () => void;
  onModify?: () => void;
  isGenerating?: boolean;
}

export function PlanningView({ 
  blueprint, 
  onApprove, 
  onModify,
  isGenerating = false 
}: PlanningViewProps) {
  if (!blueprint && !isGenerating) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Start Planning Your Project</CardTitle>
            <CardDescription>
              Describe what you want to build in the chat below, and AI will create a detailed blueprint 
              with architecture diagrams, database schemas, and implementation plans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-2">Example prompts:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• "Build a blog platform with comments and user authentication"</li>
                  <li>• "Create a task management app with teams and projects"</li>
                  <li>• "Make an e-commerce store with product catalog and checkout"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Analyzing Your Request...</CardTitle>
                <CardDescription>
                  AI is creating a detailed blueprint for your project
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['Analyzing requirements', 'Designing architecture', 'Planning database schema', 'Creating file structure'].map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Circle className="w-4 h-4 text-muted-foreground animate-pulse" />
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!blueprint) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Project Blueprint</h2>
              <p className="text-muted-foreground">{blueprint.description}</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="w-3 h-3" />
              AI Generated
            </Badge>
          </div>
        </div>

        {/* Database Schema */}
        {blueprint.database && (
          <Card className="shadow-professional">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Database Schema</CardTitle>
                  <CardDescription>
                    {blueprint.database.tables.length} tables with RLS policies
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {blueprint.database.tables.map((table, i) => (
                <div key={i} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span className="font-mono font-semibold">{table.name}</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    {table.columns.map((col, j) => (
                      <div key={j} className="text-sm text-muted-foreground font-mono">
                        • {col}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {blueprint.database.policies.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-sm">Security Policies</span>
                  </div>
                  <div className="space-y-1">
                    {blueprint.database.policies.map((policy, i) => (
                      <div key={i} className="text-sm text-muted-foreground pl-6">
                        • {policy}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* File Structure */}
        {blueprint.fileStructure && (
          <Card className="shadow-professional">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FolderTree className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>File Structure</CardTitle>
                  <CardDescription>
                    {blueprint.fileStructure.length} files to be created
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blueprint.fileStructure.map((file, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <FileCode className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium mb-1">{file.path}</div>
                      <div className="text-sm text-muted-foreground">{file.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        {blueprint.features && blueprint.features.length > 0 && (
          <Card className="shadow-professional">
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>Functionality to be implemented</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {blueprint.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Considerations */}
        {blueprint.security && blueprint.security.length > 0 && (
          <Card className="shadow-professional border-accent/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Built-in security measures</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blueprint.security.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-accent/5">
                    <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-4 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t">
          <Button 
            size="lg" 
            onClick={onApprove}
            className="gap-2 flex-1 sm:flex-none"
          >
            Approve & Build
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={onModify}
          >
            Modify Plan
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
