import {it,expect} from 'vitest'
import {configuredMemberGroups} from '../server/member-groups'
it('人员归组配置兼容组别简称且不泄露错误配置',()=>{
 expect(configuredMemberGroups('')).toEqual({})
 expect(configuredMemberGroups('{"e":"电控","m":"机械组"}')).toEqual({e:'电控组',m:'机械组'})
 for(const raw of ['secret-invalid','[]','null','{"e":"未知部门"}','{"e":["电控","机械"]}'])expect(()=>configuredMemberGroups(raw)).toThrow('INVALID_MEMBER_GROUPS_CONFIG')
})
