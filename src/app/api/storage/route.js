import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Main project config (for reference, not used in storage)
const mainFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Storage project config (using separate environment variables)
const storageFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_APP_ID,
};

// Initialize Firebase apps
const getMainApp = () => {
  const existingApp = getApps().find(app => app.name === '[DEFAULT]');
  return existingApp || initializeApp(mainFirebaseConfig);
};

const getStorageApp = () => {
  const existingApp = getApps().find(app => app.name === 'storage-app');
  return existingApp || initializeApp(storageFirebaseConfig, 'storage-app');
};

export async function POST(request) {
  try {
    const { content, filename, conversationId, documentType, contentType, isBase64 } = await request.json();

    if (!content || !filename || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: content, filename, or conversationId' },
        { status: 400 }
      );
    }

    // Check if storage bucket is configured
    if (!process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET) {
      return NextResponse.json(
        { error: 'Storage Firebase Storage bucket not configured. Please check your NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET environment variable.' },
        { status: 500 }
      );
    }

    // Initialize storage from the separate storage app
    const storageApp = getStorageApp();
    const storage = getStorage(storageApp);

    // Create storage reference
    const storageRef = ref(
      storage,
      `lease-documents/${conversationId}/${filename}`
    );

    console.log('Uploading to path:', `lease-documents/${conversationId}/${filename}`);
    console.log('Storage bucket:', process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET);
    console.log('Storage app name:', storageApp.name);

    let uploadResult;

    if (isBase64 && contentType) {
      // Handle base64 content (like PDF files)
      const dataUrl = `data:${contentType};base64,${content}`;
      uploadResult = await uploadString(storageRef, dataUrl, 'data_url');
    } else {
      // Handle text content
      uploadResult = await uploadString(storageRef, content, 'raw', {
        contentType: contentType || 'text/plain'
      });
    }
    
    console.log('Upload successful:', uploadResult.metadata.fullPath);

    const downloadURL = await getDownloadURL(uploadResult.ref);
    console.log('Download URL generated:', downloadURL);

    return NextResponse.json({
      success: true,
      downloadURL,
      filename,
      documentType,
      storageBucket: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Storage upload error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      customData: error.customData,
    });
    
    // More specific error handling
    let errorMessage = 'Failed to upload document';
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'Unauthorized access to Firebase Storage. Check your Firebase Storage rules and authentication.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Upload was canceled.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'Unknown storage error. Check your Firebase configuration and storage bucket.';
    } else if (error.code === 'app/invalid-app-argument') {
      errorMessage = 'Invalid Firebase app configuration. Check your storage project environment variables.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.message,
        code: error.code || 'unknown',
        storageBucket: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Storage API is working',
      conversationId,
      mainStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      storageProjectBucket: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET,
      appsInitialized: getApps().map(app => ({ name: app.name, projectId: app.options.projectId }))
    });

  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
