"use client";

import Header from "@/components/header";
import DocumentsContent from "@/components/documents-content";

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pb-20">
      {/* Header */}
      <Header />

      <main className="mx-auto max-w-7xl px-6 pt-24">
        <DocumentsContent />
      </main>
    </div>
  );
}
