"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Code2,
  Sparkles,
  Zap,
  GitBranch,
  Database,
  Shield,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">COCO</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered Development Platform
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Build Applications with
            <span className="gradient-primary flex items-center justify-center bg-clip-text p-2.5 text-transparent">
              AI-Driven Intelligence
              <design-placeholder></design-placeholder>
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your ideas into production-ready applications. COCO
            combines AI planning, intelligent code generation, and seamless
            deployment in one professional platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/auth/sign-up">
                Start Building Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View Demo</Link>
            </Button>
          </div>

          <div className="pt-8 text-sm text-muted-foreground">
            No credit card required • 2 free projects • Deploy in minutes
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">
            Professional Development, Simplified
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to build, deploy, and scale modern web
            applications
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>AI Planning Mode</CardTitle>
              <CardDescription>
                Describe your vision and let AI create a detailed blueprint with
                architecture diagrams, database schemas, and implementation
                plans.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 2 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Intelligent Build Mode</CardTitle>
              <CardDescription>
                Watch as AI generates production-ready code, creates database
                tables, and implements features with real-time progress
                tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 3 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Code2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Professional IDE</CardTitle>
              <CardDescription>
                Full-featured Monaco editor with IntelliSense, syntax
                highlighting, and multi-file support for a VS Code-like
                experience.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 4 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>
                Commit directly to your repositories, manage branches, and
                deploy with a single click. Full version control built-in.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 5 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Database Management</CardTitle>
              <CardDescription>
                AI can create and manage your Supabase database schema,
                including tables, RLS policies, and migrations.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 6 */}
          <Card className="shadow-professional hover:shadow-professional-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Enterprise Security</CardTitle>
              <CardDescription>
                Built-in authentication, row-level security, and secure
                sandboxed execution environment for all your projects.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">
            From Idea to Production in Minutes
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our AI-powered workflow makes professional development accessible to
            everyone
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Step 1 */}
          <div className="flex gap-6 items-start animate-slide-in">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Describe Your Vision
              </h3>
              <p className="text-muted-foreground">
                Tell COCO what you want to build in natural language. Be as
                detailed or high-level as you like.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-6 items-start animate-slide-in [animation-delay:0.1s]">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Review AI Blueprint
              </h3>
              <p className="text-muted-foreground">
                AI analyzes your requirements and creates a detailed plan with
                architecture diagrams, database schemas, and file structures.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-6 items-start animate-slide-in [animation-delay:0.2s]">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Watch It Build</h3>
              <p className="text-muted-foreground">
                Approve the plan and watch as AI generates code, creates
                databases, and implements features with real-time progress
                updates.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-6 items-start animate-slide-in [animation-delay:0.3s]">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold flex-shrink-0">
              4
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Deploy & Iterate</h3>
              <p className="text-muted-foreground">
                Preview your application live, make changes through AI chat, and
                deploy directly to GitHub when ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8 p-12 rounded-2xl gradient-primary text-white shadow-professional-lg">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-xl opacity-90">
            Join developers who are building faster with AI-powered development
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" variant="secondary" className="gap-2" asChild>
              <Link href="/auth/sign-up">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              asChild
            >
              <Link href="/dashboard">View Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl">COCO</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered development platform for modern web applications
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/features" className="hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-foreground">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-foreground">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:text-foreground">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            © 2026 COCO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
