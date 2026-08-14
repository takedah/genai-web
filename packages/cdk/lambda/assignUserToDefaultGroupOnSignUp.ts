import { PostConfirmationConfirmSignUpTriggerEvent } from 'aws-lambda';
import { GroupName } from 'genai-web';
import { addUserToGroup } from './utils/cognitoApi';
import { GROUP_NAME } from './utils/constants';

exports.handler = async (
  event: PostConfirmationConfirmSignUpTriggerEvent,
): Promise<PostConfirmationConfirmSignUpTriggerEvent> => {
  try {
    await addUserToGroup(event.userName, GROUP_NAME.UserGroup as GroupName, event.userPoolId);
    return event;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('UserGroupへの追加に失敗しました。');
    }
    throw new Error('サーバ側でエラーが発生しました。管理者へご連絡ください。');
  }
};
