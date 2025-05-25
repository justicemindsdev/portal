import React, { useState, useRef } from 'react';
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { FiUpload, FiFile, FiX, FiMaximize, FiMinimize, FiEdit, FiCheck, FiTrash } from 'react-icons/fi';
import supabase from "../utils/supabase";

const DocumentUpload = ({ roomId, userId, onUploadComplete }) => {
  // State for file uploads
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // State for file preview
  const [previewFile, setPreviewFile] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // State for file renaming
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  
  // Refs
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;
    
    // Add the selected files to our state
    setFiles(prev => [...prev, ...selectedFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      uploaded: false,
      url: null,
      error: null
    }))]);
    
    // Reset the file input
    e.target.value = null;
  };
  
  // Start upload process for all files
  const handleUpload = async () => {
    if (files.length === 0 || files.every(f => f.uploaded)) return;
    
    setUploading(true);
    const uploadPromises = files
      .filter(f => !f.uploaded && !f.error)
      .map(fileObj => uploadFile(fileObj));
    
    try {
      await Promise.all(uploadPromises);
      if (onUploadComplete) {
        onUploadComplete(files.filter(f => f.uploaded).map(f => ({ 
          id: f.id, 
          name: f.name, 
          url: f.url, 
          type: f.type,
          size: f.size
        })));
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
    }
  };
  
  // Upload a single file
  const uploadFile = async (fileObj) => {
    // Update progress for this file
    setUploadProgress(prev => ({
      ...prev,
      [fileObj.id]: 0
    }));
    
    try {
      // Create a unique file name to avoid collisions
      const fileExt = fileObj.name.split('.').pop();
      const fileName = `${roomId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      // Upload the file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, fileObj.file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(prev => ({
              ...prev,
              [fileObj.id]: percent
            }));
            
            // Also update the files array
            setFiles(prev => 
              prev.map(f => 
                f.id === fileObj.id ? { ...f, progress: percent } : f
              )
            );
          }
        });
      
      if (error) {
        throw error;
      }
      
      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      
      // Update the file object with upload info
      setFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id ? { 
            ...f, 
            uploaded: true, 
            url: urlData.publicUrl,
            storagePath: fileName,
            progress: 100
          } : f
        )
      );
      
      // Store the file metadata in the database
      const { error: dbError } = await supabase
        .from('document_files')
        .insert([
          {
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
            url: urlData.publicUrl,
            storage_path: fileName,
            room_id: roomId,
            uploaded_by: userId,
            upload_date: new Date().toISOString()
          }
        ]);
      
      if (dbError) {
        console.error('Error saving file metadata:', dbError);
      }
      
    } catch (error) {
      console.error(`Error uploading file ${fileObj.name}:`, error);
      
      // Update file with error
      setFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id ? { 
            ...f, 
            error: error.message || 'Upload failed', 
            progress: 0 
          } : f
        )
      );
    }
  };
  
  // Remove a file from the upload queue
  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };
  
  // Preview a file
  const openPreview = (file) => {
    setPreviewFile(file);
  };
  
  // Close preview
  const closePreview = () => {
    setPreviewFile(null);
    setIsFullscreen(false);
  };
  
  // Toggle fullscreen mode for preview
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Start editing a filename
  const startEditFileName = (file) => {
    setEditingFileId(file.id);
    setNewFileName(file.name);
  };
  
  // Cancel editing a filename
  const cancelEditFileName = () => {
    setEditingFileId(null);
    setNewFileName('');
  };
  
  // Save new filename
  const saveFileName = async (file) => {
    if (!newFileName.trim()) {
      cancelEditFileName();
      return;
    }
    
    // If file is not uploaded yet, just update the local state
    if (!file.uploaded) {
      setFiles(prev => 
        prev.map(f => 
          f.id === file.id ? { ...f, name: newFileName } : f
        )
      );
      cancelEditFileName();
      return;
    }
    
    try {
      // Update filename in database
      const { error } = await supabase
        .from('document_files')
        .update({ name: newFileName })
        .eq('storage_path', file.storagePath);
      
      if (error) {
        throw error;
      }
      
      // Update local state
      setFiles(prev => 
        prev.map(f => 
          f.id === file.id ? { ...f, name: newFileName } : f
        )
      );
      
    } catch (error) {
      console.error('Error updating filename:', error);
      alert('Failed to update filename');
    } finally {
      cancelEditFileName();
    }
  };
  
  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Determine file icon/thumbnail based on type
  const getFileIconOrThumbnail = (file) => {
    if (file.type.startsWith('image/') && file.url) {
      return <img src={file.url} alt={file.name} className="w-full h-full object-cover" />;
    }
    
    // Default file icon based on type
    let icon = <FiFile className="w-10 h-10 text-gray-400" />;
    
    // Customize icon based on file type
    if (file.type.includes('pdf')) {
      icon = <img src="/file.svg" alt="PDF" className="w-10 h-10" />;
    } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      icon = <img src="/file.svg" alt="Document" className="w-10 h-10" />;
    } else if (file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      icon = <img src="/file.svg" alt="Spreadsheet" className="w-10 h-10" />;
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center">
        {icon}
      </div>
    );
  };

  // Render a preview for the selected file
  const renderFilePreview = () => {
    if (!previewFile) return null;
    
    let preview;
    
    if (previewFile.type.startsWith('image/')) {
      preview = (
        <img 
          src={previewFile.url || URL.createObjectURL(previewFile.file)} 
          alt={previewFile.name}
          className="max-h-full max-w-full object-contain" 
        />
      );
    } else if (previewFile.type === 'application/pdf' && previewFile.url) {
      preview = (
        <iframe 
          src={previewFile.url} 
          title={previewFile.name}
          className="w-full h-full" 
        />
      );
    } else {
      // Generic preview for other file types
      preview = (
        <div className="flex flex-col items-center justify-center p-8">
          <FiFile size={64} className="text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">{previewFile.name}</h3>
          <p className="text-gray-400 mb-4">{formatFileSize(previewFile.size)}</p>
          <Button
            onClick={() => window.open(previewFile.url, '_blank')}
            disabled={!previewFile.url}
          >
            Download File
          </Button>
        </div>
      );
    }
    
    return (
      <Dialog 
        open={previewFile !== null} 
        onOpenChange={(open) => !open && closePreview()}
        className={isFullscreen ? 'fixed inset-0 z-50' : ''}
      >
        <DialogContent 
          className={`bg-[#1a1a1a] ${isFullscreen ? 'w-screen h-screen max-w-none rounded-none p-0' : 'sm:max-w-[900px]'}`}
        >
          <DialogHeader className="flex justify-between items-center">
            <div className="flex-1">
              {editingFileId === previewFile.id ? (
                <div className="flex items-center">
                  <Input 
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="mr-2 bg-[#252525]"
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    onClick={() => saveFileName(previewFile)}
                    className="mr-1"
                  >
                    <FiCheck />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={cancelEditFileName}
                  >
                    <FiX />
                  </Button>
                </div>
              ) : (
                <DialogTitle className="flex items-center">
                  <span className="truncate mr-2">{previewFile.name}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => startEditFileName(previewFile)}
                    title="Rename file"
                  >
                    <FiEdit size={16} />
                  </Button>
                </DialogTitle>
              )}
            </div>
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <FiMinimize /> : <FiMaximize />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={closePreview}
                title="Close"
              >
                <FiX />
              </Button>
            </div>
          </DialogHeader>
          
          <div className={`${isFullscreen ? 'flex-1 overflow-auto' : 'mt-4'} flex items-center justify-center`}>
            {preview}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-4">
      {/* Upload area */}
      <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
        
        <Button 
          type="button" 
          aria-haspopup="dialog" 
          aria-expanded="false" 
          aria-controls="radix-:r15:" 
          data-state="closed" 
          className="w-full mb-4"
          onClick={() => fileInputRef.current.click()}
        >
          <div className="w-full h-full border border-gray-700 rounded-lg bg-[#1a1a1a] cursor-pointer overflow-hidden aspect-square flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#252525] transition-colors">
            <FiUpload size={40} className="mr-2" />
            <span className="text-lg">Upload Documents</span>
          </div>
        </Button>
        
        <p className="text-gray-400 text-sm">
          Drop files here or click to browse. You can upload multiple files at once.
        </p>
      </div>
      
      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Selected Files</h3>
            
            <Button
              onClick={handleUpload}
              disabled={uploading || files.every(f => f.uploaded || f.error)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? 'Uploading...' : 'Upload All'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {files.map(file => (
              <div 
                key={file.id} 
                className="border border-gray-700 rounded-lg bg-[#252525] overflow-hidden"
              >
                {/* File thumbnail/preview */}
                <div 
                  className="w-full aspect-square cursor-pointer"
                  onClick={() => file.uploaded && openPreview(file)}
                >
                  {getFileIconOrThumbnail(file)}
                  
                  {/* Upload progress overlay */}
                  {!file.uploaded && !file.error && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="w-16 h-16 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                          <circle
                            className="text-gray-700 stroke-current"
                            strokeWidth="10"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                          <circle
                            className="text-blue-500 stroke-current"
                            strokeWidth="10"
                            strokeLinecap="round"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                            style={{
                              strokeDasharray: 251,
                              strokeDashoffset: 251 - (file.progress / 100) * 251
                            }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-white font-medium">
                          {file.progress}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Error overlay */}
                  {file.error && (
                    <div className="absolute inset-0 bg-red-900 bg-opacity-50 flex items-center justify-center">
                      <div className="text-white text-center p-2">
                        <FiX size={24} className="mx-auto mb-1" />
                        <p className="text-sm">Upload Failed</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* File info */}
                <div className="p-2">
                  {editingFileId === file.id ? (
                    <div className="flex items-center">
                      <Input 
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="text-sm bg-[#1a1a1a] h-7 mr-1"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        className="h-7 w-7 p-0" 
                        onClick={() => saveFileName(file)}
                      >
                        <FiCheck size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium truncate" title={file.name}>{file.name}</h4>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      
                      <div className="flex space-x-1 ml-2">
                        {file.uploaded && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => startEditFileName(file)}
                            title="Rename file"
                          >
                            <FiEdit size={14} />
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
                          onClick={() => removeFile(file.id)}
                          title="Remove file"
                        >
                          <FiTrash size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Success indicator */}
                  {file.uploaded && (
                    <p className="text-xs text-green-500 mt-1">Uploaded successfully</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* File preview dialog */}
      {renderFilePreview()}
    </div>
  );
};

export default DocumentUpload;
