// src/services/driveService.ts - Fixed version
import { DriveFileReference } from "../types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export class DriveService {
  private isInitializedFlag = false; // Renamed to avoid confusion
  private isSignedInFlag = false;    // Renamed to avoid confusion
  private initError: string | null = null;
  private gapi: any = null;
  private USE_REAL_UPLOADS = false; // Set to true when you want real uploads

  constructor() {
    console.log('🚀 DriveService initialized');
  }

  // PUBLIC METHODS

  isSignedIn(): boolean {
    return this.isSignedInFlag;
  }

  isInitialized(): boolean {
    return this.isInitializedFlag;
  }

  getError(): string | null {
    return this.initError;
  }

  // Public method to sign in
  async signIn(): Promise<void> {
    try {
      if (!this.isInitializedFlag) {
        await this.initialize();
      }
      
      if (this.USE_REAL_UPLOADS) {
        // TODO: Implement real Google OAuth flow here
        console.log('🔐 Real Google sign-in not implemented yet');
        throw new Error('Real Google sign-in not implemented yet');
      } else {
        // For now, use mock sign in
        await this.mockSignIn();
      }
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  // Public method to sign out
  signOut(): void {
    this.isSignedInFlag = false;
    // Keep initialized status so user can reconnect easily
    console.log('👋 Signed out from Google Drive');
  }

  // INITIALIZATION

  async initialize(): Promise<void> {
    if (this.isInitializedFlag) {
      return;
    }

    try {
      console.log('📦 Loading Google API scripts...');
      
      // Load Google API script
      await this.loadScript('https://apis.google.com/js/api.js');
      
      // Wait for gapi to be available
      await this.waitForGapi();
      
      this.gapi = window.gapi;
      this.isInitializedFlag = true;
      this.initError = null;
      
      console.log('✅ Google API loaded successfully');
    } catch (error) {
      this.initError = error instanceof Error ? error.message : 'Failed to load Google API';
      console.error('❌ Failed to initialize:', this.initError);
      throw error;
    }
  }

  // UPLOAD METHODS

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

  // CONFIGURATION METHODS

  enableRealUploads(): void {
    this.USE_REAL_UPLOADS = true;
    console.log('✅ Real Google Drive uploads enabled');
  }

  enableMockUploads(): void {
    this.USE_REAL_UPLOADS = false;
    console.log('📝 Mock uploads enabled');
  }

  // STATUS METHOD

  getStatus(): {
    isInitialized: boolean;
    isSignedIn: boolean;
    error: string | null;
    details: string;
  } {
    let details = '';
    
    if (this.initError) {
      details = this.initError;
    } else if (this.isSignedInFlag) {
      details = 'Ready for file upload - mock mode enabled';
    } else if (this.isInitializedFlag) {
      details = 'Click to connect and enable uploads';
    } else {
      details = 'Click connect to enable file uploads';
    }
    
    return {
      isInitialized: this.isInitializedFlag,
      isSignedIn: this.isSignedInFlag,
      error: this.initError,
      details
    };
  }

  // MOCK METHODS FOR TESTING

  mockSignIn(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🔐 Mock signing in...');
      setTimeout(() => {
        this.isSignedInFlag = true;
        // Don't set initialized here - it should be set only by initialize()
        console.log('✅ Mock sign-in successful');
        resolve();
      }, 1000);
    });
  }

  // UTILITY METHODS

  forceError(message: string): void {
    this.initError = message;
    this.isInitializedFlag = false;
    this.isSignedInFlag = false;
  }

  reset(): void {
    this.isInitializedFlag = false;
    this.isSignedInFlag = false;
    this.initError = null;
    this.gapi = null;
  }

  // PRIVATE HELPER METHODS

  private async uploadFilesReal(files: File[], userId: string, accessToken: string): Promise<DriveFileReference[]> {
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
}

export const driveService = new DriveService();