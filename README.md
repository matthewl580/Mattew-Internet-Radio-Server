Store the MP3 in Cloud Storage: Upload your MP3 file to Google Cloud Storage (GCS). GCS is a secure and scalable storage solution for various file types, including audio.  You can upload the file through the Firebase console, command-line tools, or within your client-side application.

Store a reference to the MP3 in Firestore: In your Firestore database, create a document with relevant information about the MP3 file. This document could include details like filename, artist, album, and a reference URL pointing to the MP3's location in Cloud Storage.

Here's an example Firestore document structure:

```
{
  "title": "My Song",
  "artist": "The Artist Name",
  "album": "The Album Title",
  "mp3Url": "gs://your-bucket-name/path/to/your/file.mp3"
}
```