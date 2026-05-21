import {useEffect, useRef, useState} from 'react'

const APP_TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN || ''

export default function Home(){
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [prompt, setPrompt] = useState('apply a friendly filter')
  const [result, setResult] = useState(null)

  useEffect(()=>{
    async function start(){
      try{
        const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
        if(videoRef.current) videoRef.current.srcObject = stream
      }catch(e){
        setStatus('camera-error')
        console.error(e)
      }
    }
    start()
    return ()=>{
      const tracks = videoRef.current?.srcObject?.getTracks?.() || []
      tracks.forEach(t=>t.stop())
    }
  },[])

  async function captureAndSend(){
    setStatus('capturing')
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setStatus('sending')
    try{
      const headers = {'Content-Type':'application/json'}
      if(APP_TOKEN) headers['x-app-token'] = APP_TOKEN

      const resp = await fetch('/api/proxy-decart', {
        method:'POST',
        headers,
        body: JSON.stringify({ image: dataUrl, prompt })
      })
      const json = await resp.json()
      setResult(json)
      setStatus('done')
    }catch(e){
      console.error(e)
      setStatus('error')
    }
  }

  return (
    <main style={{fontFamily:'system-ui,Segoe UI,Roboto',padding:20}}>
      <h1>Lucy Realtime — Next.js Secure Demo</h1>
      <p>Status: {status}</p>
      <div style={{marginTop:12,marginBottom:12}}>
        <label style={{display:'block',marginBottom:4}} htmlFor='prompt'>Prompt</label>
        <input
          id='prompt'
          value={prompt}
          onChange={e=>setPrompt(e.target.value)}
          style={{width:'100%',maxWidth:560,padding:8,borderRadius:6,border:'1px solid #ccc'}}
        />
      </div>
      <div style={{display:'flex',gap:20}}>
        <div>
          <video ref={videoRef} autoPlay playsInline muted style={{width:480,background:'#000'}} />
          <div style={{marginTop:8}}>
            <button onClick={captureAndSend}>Capture & Send</button>
          </div>
        </div>
        <div>
          <canvas ref={canvasRef} style={{display:'block',maxWidth:480}} />
        </div>
      </div>
      <section style={{marginTop:20}}>
        <h2>Decart Response</h2>
        <pre style={{whiteSpace:'pre-wrap',background:'#f4f4f4',padding:10}}>{JSON.stringify(result,null,2)}</pre>
      </section>
      <p style={{marginTop:16,fontSize:12,color:'#666'}}>This demo sends a captured frame to your Next.js API route which forwards requests to Decart using server-side secrets.</p>
    </main>
  )
}
