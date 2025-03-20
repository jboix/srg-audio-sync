package main

import (
  "bytes"
  "crypto/hmac"
  "crypto/sha1"
  "encoding/base64"
  "fmt"
  "io"
  "log"
  "mime/multipart"
  "net/http"
  "strconv"
  "time"
)

// Replace with your actual ACR Cloud credentials
const (
  acrURL       = "https://identify-eu-west-1.acrcloud.com/v1/identify" // Adjust as needed
  accessKey    = "59f7aa3a5c9ef347ebdb976aa9c3e611"
  accessSecret = "LNmwiTgo2rMKn7jph9xAHHw1B67SA6m8fjjDRV9w"
)

// generateSignature creates the signature needed by ACR Cloud.
// The string to sign is constructed as:
// "POST\n/v1/identify\n{access_key}\naudio\n1\n{timestamp}"
func generateSignature(httpMethod, uri, accessKey, dataType, signatureVersion string, timestamp int64, accessSecret string) string {
  stringToSign := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%d", httpMethod, uri, accessKey, dataType, signatureVersion, timestamp)
  mac := hmac.New(sha1.New, []byte(accessSecret))
  mac.Write([]byte(stringToSign))
  signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))
  return signature
}

// recognizeHandler handles the incoming audio from the client,
// prepares the request to ACR Cloud, and writes back the API response.
func recognizeHandler(w http.ResponseWriter, r *http.Request) {
  // Allow all origins
  w.Header().Set("Access-Control-Allow-Origin", "*")
  // Allow specific methods
  w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  // Allow specific headers
  w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

  // Handle preflight requests
  if r.Method == "OPTIONS" {
    w.WriteHeader(http.StatusOK)
    return
  }

  if r.Method != http.MethodPost {
    http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    return
  }

  // Parse the multipart form (limit to 10 MB here)
  if err := r.ParseMultipartForm(10 << 20); err != nil {
    http.Error(w, "Error parsing multipart form", http.StatusBadRequest)
    return
  }

  // Retrieve the audio file from the form data.
  file, header, err := r.FormFile("audio")
  if err != nil {
    http.Error(w, "Audio file is required", http.StatusBadRequest)
    return
  }
  defer file.Close()

  // Read the file data into a buffer.
  var audioBuffer bytes.Buffer
  if _, err := io.Copy(&audioBuffer, file); err != nil {
    http.Error(w, "Error reading audio file", http.StatusInternalServerError)
    return
  }

  // Prepare parameters required by ACR Cloud.
  httpMethod := "POST"
  uri := "/v1/identify"
  dataType := "audio"
  signatureVersion := "1"
  timestamp := time.Now().Unix()
  signature := generateSignature(httpMethod, uri, accessKey, dataType, signatureVersion, timestamp, accessSecret)

  // Build a multipart form for the request to ACR Cloud.
  var body bytes.Buffer
  writer := multipart.NewWriter(&body)

  // Required fields.
  writer.WriteField("access_key", accessKey)
  writer.WriteField("sample_bytes", strconv.Itoa(audioBuffer.Len()))
  writer.WriteField("timestamp", strconv.FormatInt(timestamp, 10))
  writer.WriteField("signature", signature)
  writer.WriteField("data_type", dataType)
  writer.WriteField("signature_version", signatureVersion)

  // Attach the audio sample.
  part, err := writer.CreateFormFile("sample", header.Filename)
  if err != nil {
    http.Error(w, "Error creating form file", http.StatusInternalServerError)
    return
  }
  part.Write(audioBuffer.Bytes())

  writer.Close()

  // Create and send the request to ACR Cloud.
  req, err := http.NewRequest("POST", acrURL, &body)
  if err != nil {
    http.Error(w, "Error creating request to ACR Cloud", http.StatusInternalServerError)
    return
  }
  req.Header.Set("Content-Type", writer.FormDataContentType())

  client := &http.Client{}
  resp, err := client.Do(req)
  if err != nil {
    http.Error(w, "Error sending request to ACR Cloud", http.StatusInternalServerError)
    return
  }
  defer resp.Body.Close()

  // Relay the ACR Cloud response back to the client.
  w.Header().Set("Content-Type", "application/json")
  io.Copy(w, resp.Body)
}

func main() {
  http.HandleFunc("/recognize", recognizeHandler)
  port := "8080"
  fmt.Printf("Local proxy server listening on http://localhost:%s\n", port)
  log.Fatal(http.ListenAndServe(":"+port, nil))
}
