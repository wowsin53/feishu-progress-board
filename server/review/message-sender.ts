import axios from 'axios'
import { auth } from './feishu'
import type { MessageSender } from './feedback-worker'
export class FeishuReviewSender implements MessageSender {
  async send(recipient:string,text:string,uuid:string):Promise<string> {
    if(!/^ou_[A-Za-z0-9]+$/.test(recipient))throw new Error('REVIEW_RECIPIENT_INVALID')
    try {
      const {data}=await axios.post('https://open.feishu.cn/open-apis/im/v1/messages',
        {receive_id:recipient,msg_type:'text',content:JSON.stringify({text}),uuid},
        {params:{receive_id_type:'open_id'},headers:{Authorization:'Bearer '+await auth()},timeout:15000,maxRedirects:0})
      if(data.code!==0)throw new Error(Number.isInteger(data.code)?'REVIEW_SEND_CODE_'+data.code:'REVIEW_SEND_UNCONFIRMED')
      if(typeof data.data?.message_id!=='string')throw new Error('REVIEW_SEND_UNCONFIRMED')
      return data.data.message_id
    } catch(e) {
      if(e instanceof Error && /^REVIEW_SEND_CODE_[0-9]+$/.test(e.message))throw e
      if(axios.isAxiosError(e) && Number.isInteger(e.response?.data?.code))throw new Error('REVIEW_SEND_CODE_'+e.response!.data.code)
      throw new Error('REVIEW_SEND_UNCONFIRMED')
    }
  }
}
