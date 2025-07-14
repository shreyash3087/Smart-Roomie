import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export async function POST(request) {
  try {
    const { content, filename, conversationId, documentType } = await request.json();

    if (!content || !filename || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: content, filename, or conversationId' },
        { status: 400 }
      );
    }

    // Check if storage bucket is configured
    if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      return NextResponse.json(
        { error: 'Firebase Storage bucket not configured. Please check your environment variables.' },
        { status: 500 }
      );
    }

    // Initialize storage
    const storage = getStorage(app);

    // Create storage reference
    const storageRef = ref(
      storage,
      `lease-documents/${conversationId}/${filename}`
    );

    console.log('Uploading to path:', `lease-documents/${conversationId}/${filename}`);
    console.log('Storage bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

    // Upload as string instead of blob (sometimes works better)
    const uploadResult = await uploadString(storageRef, content, 'raw', {
      contentType: 'text/plain'
    });
    
    console.log('Upload successful:', uploadResult.metadata.fullPath);

    const downloadURL = await getDownloadURL(uploadResult.ref);
    console.log('Download URL generated:', downloadURL);

    return NextResponse.json({
      success: true,
      downloadURL,
      filename,
      documentType,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Storage upload error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      customData: error.customData,
      stack: error.stack
    });
    
    // More specific error handling
    let errorMessage = 'Failed to upload document';
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'Unauthorized access to Firebase Storage. Check your Firebase rules.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Upload was canceled.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'Unknown storage error. Check your Firebase configuration and storage bucket.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.message,
        code: error.code || 'unknown'
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
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });

  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}