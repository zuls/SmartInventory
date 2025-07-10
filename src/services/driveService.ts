// src/services/driveService.ts
import { DriveFileReference } from "../types";

// Load the Google API script dynamically
const loadGapiScript = () => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gapi-script')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gapi-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject('Failed to load GAPI script.');
    document.body.appendChild(script);
  });
};

export class DriveService {
  // --- REPLACE WITH YOUR GOOGLE CLOUD CREDENTIALS ---
  private API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  private CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  // ----------------------------------------------------

  private DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
  private SCOPES = "https://www.googleapis.com/auth/drive.file";
  private gapi: any = null;
  private parentFolderId: string | null = null;
  private isInitialized = false;

  constructor() {
    this.initClient = this.initClient.bind(this);
    this.uploadFiles = this.uploadFiles.bind(this);
  }

  // Step 1: Initialize the Google API client
  async initClient() {
    if (this.isInitialized) return;

    await loadGapiScript();
    
    await new Promise<void>((resolve) => {
      window.gapi.load('client:auth2', async () => {
        try {
          this.gapi = window.gapi;
          await this.gapi.client.init({
            apiKey: this.API_KEY,
            clientId: this.CLIENT_ID,
            discoveryDocs: this.DISCOVERY_DOCS,
            scope: this.SCOPES,
          });

          // Listen for sign-in state changes
          this.gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus);
          
          // Handle the initial sign-in state
          this.updateSigninStatus(this.gapi.auth2.getAuthInstance().isSignedIn.get());
          
          this.isInitialized = true;
          resolve();

        } catch (error) {
          console.error("Error initializing Google API client", error);
        }
      });
    });
  }
  
  // Step 2: Handle Sign-in/Sign-out
  private updateSigninStatus = (isSignedIn: boolean) => {
    if (isSignedIn) {
      console.log("Google Drive API: Signed in.");
    } else {
      console.log("Google Drive API: Signed out.");
    }
  }

  public signIn = () => {
    if (this.gapi) {
      this.gapi.auth2.getAuthInstance().signIn();
    } else {
      console.error("GAPI client not initialized.");
    }
  }

  public signOut = () => {
    if (this.gapi) {
      this.gapi.auth2.getAuthInstance().signOut();
    }
  }
  
  public isSignedIn = (): boolean => {
    return this.gapi?.auth2?.getAuthInstance()?.isSignedIn?.get() || false;
  }

  // Step 3: Main file upload logic
  async uploadFiles(files: File[], userId: string): Promise<DriveFileReference[]> {
    if (!this.isSignedIn()) {
      // Prompt user to sign in if they are not
      this.signIn();
      throw new Error("Please sign in to Google Drive to upload files.");
    }

    // Ensure the main parent folder exists
    const parentFolderId = await this.findOrCreateFolder("WarehouseAppUploads");
    // Ensure the year/month subfolder exists
    const subFolderId = await this.findOrCreateFolder(this.getCurrentYearMonth(), parentFolderId);
    
    const uploadedFiles: DriveFileReference[] = [];

    for (const file of files) {
      const metadata = {
        name: `${Date.now()}-${file.name}`,
        mimeType: file.type,
        parents: [subFolderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + this.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token }),
        body: form,
      });

      const driveFile = await res.json();
      
      // Make the file publicly readable
      await this.gapi.client.drive.permissions.create({
          fileId: driveFile.id,
          resource: {
              role: 'reader',
              type: 'anyone',
          }
      });
      
      // Get the web link for viewing
      const fileDetails = await this.gapi.client.drive.files.get({
          fileId: driveFile.id,
          fields: 'webViewLink, thumbnailLink'
      });


      uploadedFiles.push({
        fileId: driveFile.id,
        fileName: driveFile.name,
        webViewLink: fileDetails.result.webViewLink,
        fileType: 'image', // Or derive from mimeType
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
      });
    }

    return uploadedFiles;
  }
  
  private getCurrentYearMonth = (): string => {
      const date = new Date();
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}`;
  }

  // Helper to find or create a folder
  private async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    // Search for the folder
    let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
    if(parentId) {
        query += ` and '${parentId}' in parents`;
    }

    const response = await this.gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });

    if (response.result.files && response.result.files.length > 0) {
      return response.result.files[0].id;
    } else {
      // Create the folder
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] })
      };
      const newFolder = await this.gapi.client.drive.files.create({ resource: folderMetadata, fields: 'id' });
      return newFolder.result.id;
    }
  }
}

export const driveService = new DriveService();