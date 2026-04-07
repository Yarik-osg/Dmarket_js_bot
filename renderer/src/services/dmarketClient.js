// DMarketClient for renderer process using fetch API

import nacl from 'tweetnacl';

function byteToHexString(uint8arr) {
    if (!uint8arr) {
        return '';
    }
    let hexStr = '';
    for (let i = 0; i < uint8arr.length; i++) {
        let hex = (uint8arr[i] & 0xff).toString(16);
        hex = (hex.length === 1) ? '0' + hex : hex;
        hexStr += hex;
    }
    return hexStr;
}

function hexStringToByte(str) {
    if (typeof str !== 'string') {
        throw new TypeError('Wrong data type passed to convertor. Hexadecimal string is expected');
    }
    const uInt8arr = new Uint8Array(str.length / 2);
    for (let i = 0, j = 0; i < str.length; i += 2, j++) {
        uInt8arr[j] = parseInt(str.substr(i, 2), 16);
    }
    return uInt8arr;
}

export class DMarketClient {
    constructor(publicKey, secretKey) {
        if (!publicKey || !secretKey) {
            throw new Error('Public and secret keys must be provided.');
        }
        this.publicKey = publicKey;
        this.secretKey = secretKey;
        this.rootApiUrl = 'https://api.dmarket.com';
        this.signaturePrefix = 'dmar ed25519 ';
    }

    async call(method, path, payload = null) {
        method = method.toUpperCase();
        const timestamp = Math.floor(new Date().getTime() / 1000);
        let apiUrlPath = path;
        let requestBody = '';

        // Handle payload
        if (payload) {
            if (method === 'GET') {
                // For GET, add params to URL
                const params = new URLSearchParams();
                for (const [key, value] of Object.entries(payload)) {
                    if (value === null || value === undefined) continue;
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            if (item !== null && item !== undefined) {
                                params.append(key, String(item));
                            }
                        }
                    } else {
                        params.append(key, String(value));
                    }
                }
                const queryString = params.toString();
                if (queryString) {
                    apiUrlPath = `${path}?${queryString}`;
                }
                // Debug logging
                console.log('GET request params:', payload, '-> URL:', apiUrlPath);
            } else {
                // For POST, PUT, DELETE with body
                requestBody = JSON.stringify(payload);
            }
        }

        // Build string to sign: METHOD + PATH + BODY + TIMESTAMP
        const stringToSign = method + apiUrlPath + requestBody + timestamp;
        const signature = this._generateSignature(stringToSign);

        const headers = {
            'X-Api-Key': this.publicKey,
            'X-Request-Sign': this.signaturePrefix + signature,
            'X-Sign-Date': timestamp.toString(),
        };

        if (method !== 'GET' && requestBody) {
            headers['Content-Type'] = 'application/json';
        }

        const url = `${this.rootApiUrl}${apiUrlPath}`;
        
        const fetchOptions = {
            method: method,
            headers: headers,
        };

        if (method !== 'GET' && requestBody) {
            fetchOptions.body = requestBody;
        }

        try {
            const response = await fetch(url, fetchOptions);
            const data = await response.text();
            
            if (!response.ok) {
                // Log error details for debugging
                console.error('API Error:', {
                    url,
                    method,
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: data
                });
                throw new Error(`API call failed with status code ${response.status}: ${data}`);
            }
            
            try {
                return JSON.parse(data);
            } catch (e) {
                throw new Error('Failed to parse JSON response.');
            }
        } catch (error) {
            throw error;
        }
    }

    _generateSignature(stringToSign) {
        const secretKeyBytes = hexStringToByte(this.secretKey);
        const signatureBytes = nacl.sign.detached(new TextEncoder('utf-8').encode(stringToSign), secretKeyBytes);
        return byteToHexString(signatureBytes);
    }
}
