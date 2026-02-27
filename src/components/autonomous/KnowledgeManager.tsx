"use client";

import { useState, useRef } from "react";
import { useUIStore } from "@/store/uiStore";
import { motion, AnimatePresence } from "framer-motion";

export default function KnowledgeManager() {
    const { activeKnowledgeSources, setActiveKnowledgeSources } = useUIStore();

    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file?: File, url?: string) => {
        setIsUploading(true);
        const formData = new FormData();

        if (file) {
            if (file.type !== "application/pdf" && file.type !== "text/plain") {
                alert("Only PDF and TXT files are supported for now.");
                setIsUploading(false);
                return;
            }
            formData.append("file", file);
        } else if (url) {
            try {
                new URL(url); // Basic validation
                formData.append("url", url);
            } catch (err) {
                alert("Please enter a valid URL.");
                setIsUploading(false);
                return;
            }
        } else {
            setIsUploading(false);
            return;
        }

        try {
            const res = await fetch("http://localhost:8000/api/knowledge/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setActiveKnowledgeSources([
                    ...activeKnowledgeSources,
                    {
                        id: crypto.randomUUID(),
                        type: data.type === 'file' ? (file?.type === "application/pdf" ? "pdf" : "txt") : "url",
                        path: data.path,
                        name: data.name
                    }
                ]);
                if (url) setUrlInput(""); // Reset URL input on success
            } else {
                alert("Failed to upload knowledge source.");
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Network error. Make sure the backend is running.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    const handleRemoveSource = (idToRemove: string) => {
        setActiveKnowledgeSources(activeKnowledgeSources.filter(s => s.id !== idToRemove));
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Knowledge Base
                </h3>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">RAG Pipeline</span>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Upload PDFs, TXTs, or provide Web URLs to augment your agents with persistent context.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Drag and Drop Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-32
                        ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".pdf,.txt"
                        className="hidden"
                    />
                    <svg className={`w-8 h-8 mb-2 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {isUploading ? "Uploading..." : "Click or drag PDF/TXT to upload"}
                    </span>
                </div>

                {/* URL Input Form */}
                <div className="flex flex-col justify-center h-32 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <label className="text-xs font-semibold text-slate-500 mb-2">Web URL Scraping</label>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://docs.crewai.com"
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpload(undefined, urlInput);
                            }}
                        />
                        <button
                            onClick={() => handleUpload(undefined, urlInput)}
                            disabled={isUploading || !urlInput}
                            className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            {isUploading ? "Add..." : "Add"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Sources List */}
            {activeKnowledgeSources.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Active Sources ({activeKnowledgeSources.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        <AnimatePresence>
                            {activeKnowledgeSources.map((source) => (
                                <motion.div
                                    key={source.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-1.5 rounded-md flex-shrink-0 ${source.type === 'pdf' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                                                source.type === 'txt' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' :
                                                    'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                            }`}>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                {source.type === 'url' ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                )}
                                            </svg>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                            {source.name}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveSource(source.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                        title="Remove source"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    );
}
