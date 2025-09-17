import React from 'react';

export default function DocumentUploadPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 className="text-2xl font-semibold mb-4">Belge Yükle</h1>
      {/* Show the standalone form in full-width iframe so it appears in the main content area */}
      <iframe
        src="/s_index.html"
        title="Document Upload"
        style={{ width: '100%', height: '80vh', border: '1px solid #e5e7eb', borderRadius: 6 }}
      />
    </div>
  );
}
