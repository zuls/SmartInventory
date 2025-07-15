// src/services/driveService.ts - Simple and reliable version
import { DriveFileReference } from "../types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export class DriveService {
  private isInitialized = false;
  private isSignedIn = false;
  private initError: string | null = null;
  private gapi: any = null;

  constructor() {
    console.log('🚀 DriveService initialized');
  }

  // Simple initialization that just loads the scripts
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('📦 Loading Google API scripts...');
      
      // Load Google API script
      await this.loadScript('https://apis.google.com/js/api.js');
      
      // Wait for gapi to be available
      await this.waitForGapi();
      
      this.gapi = window.gapi;
      this.isInitialized = true;
      this.initError = null;
      
      console.log('✅ Google API loaded successfully');
    } catch (error) {
      this.initError = error instanceof Error ? error.message : 'Failed to load Google API';
      console.error('❌ Failed to initialize:', this.initError);
      throw error;
    }
  }

  // Toggle between mock and real uploads
  private USE_REAL_UPLOADS = false; // Set to true when you want real uploads

  // Simple sign-in using Google's built-in picker
  async signInAndUpload(files: File[], userId: string): Promise<DriveFileReference[]> {
    try {
      console.log('🔐 Starting upload process...');
      
      if (this.USE_REAL_UPLOADS) {
        // Real upload implementation
        console.log('📤 Using REAL Google Drive upload');
        return await this.uploadFilesReal(files, userId, 'access-token-here');
      } else {
        // Mock upload for testing
        console.log('📤 Using MOCK upload (no files actually uploaded)');
        
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Return mock drive file references that look real
        const mockFiles = files.map((file, index) => ({
          fileId: `mock_file_${Date.now()}_${index}`,
          fileName: `${Date.now()}-${file.name}`,
          webViewLink: `https://drive.google.com/file/d/mock_file_${Date.now()}_${index}/view`,
          fileType: 'image' as const,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        }));
        
        console.log('✅ Mock upload completed successfully');
        console.log('⚠️  NOTE: Files were NOT actually uploaded to Google Drive');
        return mockFiles;
      }
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Upload failed');
    }
  }

  // Enable real uploads (call this when ready)
  enableRealUploads(): void {
    this.USE_REAL_UPLOADS = true;
    console.log('✅ Real Google Drive uploads enabled');
  }

  // Disable real uploads (back to mock)
  enableMockUploads(): void {
    this.USE_REAL_UPLOADS = false;
    console.log('📝 Mock uploads enabled');
  }

  // Alternative: Direct upload without complex authentication
  async uploadWithPicker(files: File[], userId: string): Promise<DriveFileReference[]> {
    // Simple mock upload that always works
    console.log('📤 Mock uploading files:', files.map(f => f.name));
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock drive file references
    return files.map((file, index) => ({
      fileId: `mock_file_${Date.now()}_${index}`,
      fileName: `${Date.now()}-${file.name}`,
      webViewLink: `https://drive.google.com/file/d/mock_file_${Date.now()}_${index}/view`,
      fileType: 'image' as const,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
    }));
  }

  // Real upload implementation (use when you want actual uploads)
  async uploadFilesReal(files: File[], userId: string, accessToken: string): Promise<DriveFileReference[]> {
    const uploadedFiles: DriveFileReference[] = [];
    
    for (const file of files) {
      try {
        // Create folder if needed
        const folderId = await this.ensureFolder('WarehouseAppUploads', accessToken);
        
        // Upload file
        const formData = new FormData();
        const metadata = {
          name: `${Date.now()}-${file.name}`,
          parents: [folderId]
        };
        
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        uploadedFiles.push({
          fileId: result.id,
          fileName: result.name,
          webViewLink: `https://drive.google.com/file/d/${result.id}/view`,
          fileType: 'image',
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        });
        
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Continue with other files
      }
    }
    
    return uploadedFiles;
  }

  // Helper to ensure folder exists
  private async ensureFolder(folderName: string, accessToken: string): Promise<string> {
    try {
      // Search for existing folder
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      
      const searchResult = await searchResponse.json();
      
      if (searchResult.files && searchResult.files.length > 0) {
        return searchResult.files[0].id;
      }
      
      // Create folder
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      
      const createResult = await createResponse.json();
      return createResult.id;
      
    } catch (error) {
      console.error('Failed to ensure folder:', error);
      throw error;
    }
  }

  // Load script helper
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  // Wait for gapi to be available
  private waitForGapi(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds
      
      const check = () => {
        attempts++;
        if (window.gapi) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Google API not available after loading'));
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }

  // Status methods
  getStatus(): {
    isInitialized: boolean;
    isSignedIn: boolean;
    error: string | null;
    details: string;
  } {
    let details = '';
    
    if (this.initError) {
      details = this.initError;
    } else if (this.isSignedIn) {
      details = 'Ready for file upload - mock mode enabled';
    } else if (this.isInitialized) {
      details = 'Click to connect and enable uploads';
    } else {
      details = 'Click connect to enable file uploads';
    }
    
    return {
      isInitialized: this.isInitialized,
      isSignedIn: this.isSignedIn,
      error: this.initError,
      details
    };
  }

  // Mock sign in for testing
  mockSignIn(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🔐 Mock signing in...');
      setTimeout(() => {
        this.isSignedIn = true;
        this.isInitialized = true; // Also mark as initialized
        console.log('✅ Mock sign-in successful');
        resolve();
      }, 1000);
    });
  }

  signOut(): void {
    this.isSignedIn = false;
    // Keep initialized status so user can reconnect easily
    console.log('👋 Signed out');
  }

  // For testing - force error
  forceError(message: string): void {
    this.initError = message;
    this.isInitialized = false;
    this.isSignedIn = false;
  }

  // Reset everything
  reset(): void {
    this.isInitialized = false;
    this.isSignedIn = false;
    this.initError = null;
    this.gapi = null;
  }
}

export const driveService = new DriveService();