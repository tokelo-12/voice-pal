'use client';

import React, { useState } from 'react';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import evaluationData from '@/ai/evaluation-dataset.json';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, XCircle, Loader2, ChevronLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function EvaluatePage() {
  const [results, setResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runEvaluation = async () => {
    setIsRunning(true);
    const newResults = [];

    for (const testCase of evaluationData) {
      try {
        const actual = await interpretVoiceCommand(testCase.input);
        
        // Simple comparison logic
        const isIntentMatch = actual.intent === testCase.expected.intent;
        
        // Check if expected details keys exist and match values (if provided in expected)
        const expectedDetailsKeys = Object.keys(testCase.expected.details);
        const isDetailsMatch = expectedDetailsKeys.every(key => {
          const expectedVal = (testCase.expected.details as any)[key];
          const actualVal = (actual.details as any)[key];
          return actualVal === expectedVal;
        });

        newResults.push({
          ...testCase,
          actual,
          status: isIntentMatch && isDetailsMatch ? 'pass' : 'fail',
          error: null
        });
      } catch (err: any) {
        newResults.push({
          ...testCase,
          actual: null,
          status: 'error',
          error: err.message
        });
      }
      // Update results as we go to show progress
      setResults([...newResults]);
    }
    setIsRunning(false);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail' || r.status === 'error').length;

  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-body">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Link href="/" className="inline-flex items-center text-primary hover:underline gap-1 text-sm font-bold uppercase tracking-widest">
              <ChevronLeft className="w-4 h-4" />
              Back to App
            </Link>
            <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">
              AI Reliability <span className="text-primary">Audit</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Validating multilingual intent detection and entity extraction.
            </p>
          </div>
          
          <Button 
            onClick={runEvaluation} 
            disabled={isRunning}
            className="h-20 px-10 text-xl font-black rounded-2xl gap-3 shadow-2xl transition-all hover:scale-105"
          >
            {isRunning ? <Loader2 className="animate-spin w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            {isRunning ? "AUDITING..." : "RUN EVALUATION"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-secondary/20 border-border/50 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Scenarios</p>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black">{evaluationData.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-green-500">Passed</p>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-green-500">{passCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-red-500">Failed / Errors</p>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-red-500">{failCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card className="rounded-3xl border-border/50 bg-secondary/10 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-bold uppercase text-xs tracking-wider h-14">Case</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Spoken Input</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Expected Intent</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">AI Result</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-24">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <AlertCircle className="w-16 h-16" />
                      <p className="text-xl font-bold uppercase">No data processed yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result, idx) => (
                  <TableRow key={idx} className="border-border/50 hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-bold text-sm py-6">{result.testCase}</TableCell>
                    <TableCell className="italic text-muted-foreground">"{result.input.command}"</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] tracking-tighter uppercase border-primary/30 text-primary">
                        {result.expected.intent}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {result.actual ? (
                        <Badge 
                          variant={result.actual.intent === result.expected.intent ? "secondary" : "destructive"}
                          className="font-mono text-[10px] tracking-tighter uppercase"
                        >
                          {result.actual.intent}
                        </Badge>
                      ) : (
                        <span className="text-red-500 text-xs font-bold">ERROR</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {result.status === 'pass' && (
                        <div className="flex items-center justify-end gap-2 text-green-500 font-black">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-xs uppercase">PASS</span>
                        </div>
                      )}
                      {(result.status === 'fail' || result.status === 'error') && (
                        <div className="flex items-center justify-end gap-2 text-red-500 font-black">
                          <XCircle className="w-5 h-5" />
                          <span className="text-xs uppercase">{result.status.toUpperCase()}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Observation Footer */}
        {results.length > 0 && failCount > 0 && (
          <div className="p-8 bg-red-500/10 border-2 border-red-500/30 rounded-[2rem] flex items-start gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-3 bg-red-500 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase text-red-500">Auditor Observations</h3>
              <p className="text-muted-foreground">
                Discrepancies detected in {failCount} test cases. This indicates the AI prompt in 
                <code className="mx-1 px-2 py-0.5 bg-secondary rounded text-foreground font-mono">interpret-voice-command-flow.ts</code> 
                requires additional contextual examples or specific language rules to handle these variations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
