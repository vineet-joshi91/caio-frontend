"use client";
import React, { useState } from "react";

const DashboardPage = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadedFile(file);
  };

  const handleUpload = () => {
    if (!uploadedFile) return;
    alert(`Pretending to upload file: ${uploadedFile.name}`);
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!uploadedFile}>
        Upload
      </button>
    </div>
  );
};

export default DashboardPage;
