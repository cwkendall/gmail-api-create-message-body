/**
 * Takes a key-value object representing headers and their values and turns it
 * into a header string.
 * @param  {object} headers
 * @return {string}
 */
function createHeaders(headers) {
  if (!headers || headers.length === 0) {
    return '';
  }

  var result = [];
  for (var h in headers) {
    if (headers.hasOwnProperty(h)) {
      result.push(h + ': ' + headers[h] + '\r\n');
    }
  }

  return result.join('');
}

/**
 * The only field in the json part of the message is the threadId.
 * If it is given, it is placed in the json. Otherwise, nothing will be added at all.
 * @param  {string} [threadId] - Id representing the thread the message should be put into
 * @param  {object}   params.[draft] - contains id
 * @return {string}
 */
function createJson(threadId, draft) {
  return [
    'Content-Type: application/json; charset="UTF-8"\r\n\r\n',

    '{\r\n',
      (draft && draft.id ? '"id": "' +draft.id + '",\r\n' : ''),
      (draft ? '"message": {\r\n' : ''),
      (threadId ? '  "threadId": "' + threadId + '"\r\n' : ''),
      (draft ? '}\r\n' : ''),
    '}'
  ].join('');
}

/**
 * Creates a plain text message string.
 * @param  {string} textPlain
 * @return {string}
 */
function createPlain(textPlain) {
  return [
    'Content-Type: text/plain; charset="UTF-8"\r\n',
    'MIME-Version: 1.0\r\n',
    'Content-Transfer-Encoding: 7bit\r\n\r\n',

    textPlain
  ].join('');
}

/**
 * Creates a html text message string.
 * @param  {string} textPlain
 * @return {string}
 */
function createHtml(textHtml) {
  return [
    'Content-Type: text/html; charset="UTF-8"\r\n',
    'MIME-Version: 1.0\r\n',
    'Content-Transfer-Encoding: 7bit\r\n\r\n',

    textHtml
  ].join('');
}

/**
 * If both plain text and html text representations are given, both of them
 * are given as alternatives.
 * @param  {string} textPlain
 * @param  {string} textHtml
 * @return {string}
 */
function createAlternative(textPlain, textHtml) {
  return [
    'Content-Type: multipart/alternative; boundary="foo"\r\n\r\n',

    '--foo\r\n',
    createPlain(textPlain), '\r\n\r\n',

    '--foo\r\n',
    createHtml(textHtml), '\r\n\r\n',

    '--foo--',
  ].join('');
}

/**
 * Creates a proper representaion of the text that is given. If neither a
 * plain text or html text is given, an empty string is returned.
 * @param  {string} [textPlain]
 * @param  {string} [textHtml]
 * @return {string}
 */
function createText(textPlain, textHtml) {
  if (textPlain && textHtml) {
    return createAlternative(textPlain, textHtml);
  } else if (textPlain) {
    return createPlain(textPlain);
  } else if (textHtml) {
    return createHtml(textHtml);
  } else {
    return '';
  }
}

/**
 * Creates a proper representaion of the attachments that are given.
 * If no attachments are given, an empty string is returned.
 * @param  {object[]} [attachments]
 * @param  {string} attachments[].[name]
 * @param  {string} attachments[].type
 * @param  {string} attachments[].data
 * @return {string}
 */
function createAttachments(attachments) {
  if (!attachments || attachments.length === 0) {
    return '';
  }

  var result = [];
  for (var i = 0; i < attachments.length; i++) {
    var a = attachments[i];
    result = result.concat([
      '--foo_bar\r\n',
      'Content-Type: ', a.type, '\r\n',
      'MIME-Version: 1.0\r\n',
      'Content-Transfer-Encoding: base64\r\n',
      'Content-Disposition: attachment', (a.name ? '; filename="' + a.name + '"' : ''), '\r\n\r\n',

      a.data, '\r\n\r\n'
    ]);
  }

  return result.join('');
}

/**
 * Creates a proper representaion of the inline images that are given.
 * If no images are given, existing message body is returned.
 * @param  {object[]} [text]
 * @param  {object[]} [images]
 * @param  {string} images[].[name]
 * @param  {string} images[].id
 * @param  {string} images[].type
 * @param  {string} images[].data
 * @return {string}
 */
function createImages(text, images) {
  if (!images || images.length === 0) {
    return text;
  }

  var result = [];
  //prepend text
  result.push(
    'Content-Type: multipart/related; boundary="fizz_buzz"\r\n\r\n',
    '--fizz_buzz\r\n',
    text,
    '\r\n\r\n'
  );
  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    result = result.concat([
      '--fizz_buzz\r\n',
      'Content-Type: ', img.type, (img.name ? '; name="' + img.name + '"' : ''), '\r\n',
      'MIME-Version: 1.0\r\n',
      'Content-ID: <', img.id, '>\r\n',
      'Content-Transfer-Encoding: base64\r\n',
      'Content-Disposition: inline', (img.name ? '; filename="' + img.name + '"' : ''), '\r\n\r\n',

      img.data, '\r\n\r\n'
    ]);
  }
  result.push('--fizz_buzz--');

  return result.join('');
}


/**
 * Creates a message body that can be used for the Gmail API simple upload urls.
 * @param  {object}   params
 * @param  {object}   params.[draft]              - draft metadata to be used
 * @param  {object}   params.[draft].[id]         - Id of existing draft to be updated
 * @param  {object}   params.[headers]            - Key-value object representing headers and their values
 * @param  {string}   params.[threadId]           - Id of the thread the message should be put into
 * @param  {string}   params.[textPlain]          - Plain text representation of the message
 * @param  {string}   params.[textHtml]           - Html text representation of the message
 * @param  {object[]} params.[embedded]
 * @param  {string}   params.embedded[].type      - Object/embed type ('image/jpeg', 'image/png', ...)
 * @param  {string}   params.embedded[].id        - Content ID for objects embedded inline
 * @param  {string}   params.embedded[].[name]    - Name of the embedded object
 * @param  {string}   params.embedded[].data      - Base64 representation of the embedded data
 * @param  {object[]} params.[attachments]
 * @param  {string}   params.attachments[].type   - Attachment type ('image/jpeg', 'image/png', ...)
 * @param  {string}   params.attachments[].[name] - Name of the attachment
 * @param  {string}   params.attachments[].data   - Base64 representation of the attachment data
 * @return {string}
 */
module.exports = function createBody(params) {
  var json = createJson(params.threadId, params.draft);
  var headers = createHeaders(params.headers);
  var text = createText(params.textPlain, params.textHtml);
  text = createImages(text, params.embedded);
  var attachments = createAttachments(params.attachments);

  return [
    '--foo_bar_baz\r\n',
    json, '\r\n\r\n',

    '--foo_bar_baz\r\n',
    'Content-Type: message/rfc822\r\n\r\n',

    'Content-Type: multipart/mixed; boundary="foo_bar"\r\n',
    headers, '\r\n',

    '--foo_bar\r\n',
    text, '\r\n\r\n',

    attachments,

    '--foo_bar--\r\n\r\n',

    '--foo_bar_baz--',
  ].join('');
};
