
function Video(props){
    return (
        <>
            <video width="320" height="240" controls src={props.videoUrl} />
        </>
    )
}

export { Video };