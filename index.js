module.exports = async function makeIndexFetch (opts = {}) {
  const { makeRoutedFetch } = await import('make-fetch')
  const {fetch, router} = makeRoutedFetch({onNotFound: handleEmpty, onError: handleError})
  const { default: nodeFetch } = await import('node-fetch')
  const finalOpts = { timeout: 30000, ...opts }
  const useTimeOut = finalOpts.timeout

  function handleEmpty(request) {
    const { url, headers: reqHeaders, method, body, signal } = request
    if(signal){
      signal.removeEventListener('abort', takeCareOfIt)
    }
    const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
    const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
    return {status: 400, headers: { 'Content-Type': mainRes }, body: mainReq ? `<html><head><title>${url}</title></head><body><div><p>did not find any data</p></div></body></html>` : JSON.stringify('did not find any data')}
  }

  function handleError(e, request) {
    const { url, headers: reqHeaders, method, body, signal } = request
    if(signal){
      signal.removeEventListener('abort', takeCareOfIt)
    }
    const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
    const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
    return {status: 500, headers: { 'X-Error': e.name, 'Content-Type': mainRes }, body: mainReq ? `<html><head><title>${e.name}</title></head><body><div><p>${e.stack}</p></div></body></html>` : JSON.stringify(e.stack)}
  }

  async function handleData(timeout, data) {
    if (timeout) {
      return await Promise.race([
        new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, timeout)),
        data
      ])
    } else {
      return await data
    }
  }

  function takeCareOfIt(data){
    console.log(data)
    throw new Error('aborted')
  }

  function sendTheData(theSignal, theData){
    if(theSignal){
      theSignal.removeEventListener('abort', takeCareOfIt)
    }
    return theData
  }

  async function handleLayer(request) {
    const { url, method, headers: reqHeaders, body, signal, referrer } = request

    if(signal){
      signal.addEventListener('abort', takeCareOfIt)
    }
    const mainURL = new URL(url)

      if(mainURL.hostname === '_'){
        return {status: 200, headers: {'Content-Type': 'text/plain; charset=utf-8'}, body: 'running'}
      }

    const useLink = request.url.replace('lok', 'http')
    delete request.url
    const mainTimeout = reqHeaders.has('x-timer') || mainURL.searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || mainURL.searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || mainURL.searchParams.get('x-timer')) * 1000 : undefined : useTimeOut
    
    return sendTheData(signal, await handleData(mainTimeout, nodeFetch(useLink, request)))
  }

  router.any('lok://*/**', handleLayer)
  router.any('loks://*/**', handleLayer)

  return fetch
}