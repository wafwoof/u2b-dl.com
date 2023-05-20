import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Video } from './components/video.jsx';
import './style.css';

console.log("Example Video URL:     https://www.youtube.com/watch?v=jNQXAC9IVRw")

export function App() {

  const [downloadedVideos, setDownloadedVideos] = useState([]);

  async function submitVideoToAPI() {
    console.log('submitting video to API');
    // get the user input
    const userInput = document.getElementById('user_input_url').value;
    console.log('userInput:', userInput);
    // validate the user input
    if (!userInput || userInput.length < 9 || userInput.length > 100) {
      alert('Please enter a Valid YouTube URL.');
      return;
    }

    // send the user input to the API
    const response = await fetch('http://127.0.0.1:3000/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url: userInput,
        format: 'mp4'
      })
    });

    // get the response from the API
    const data = await response.json();
    console.log('data:', data);

    // update the state
    setDownloadedVideos([...downloadedVideos, data]);
  }

  return (
    <>
      <div className="main">
        <h1>u2b-dl</h1>
        <code>The Simple YouTube Downloader.</code>
        <input id="user_input_url" type="text" placeholder='Enter a YouTube URL' />
        <button onClick={() => submitVideoToAPI()}>Download</button>
        <code>Downloaded Videos:</code>
        <div className="downloaded_videos" id="downloaded_videos">
          {downloadedVideos.map((video) => {
            return <Video videoUrl={video.url} />
          })}
        </div>
        <div className="advertisments">
          <h2>And now a word from our sponsors:</h2>
        </div>
      </div>
    </>
  )
}

render(<App />, document.getElementById('app'));