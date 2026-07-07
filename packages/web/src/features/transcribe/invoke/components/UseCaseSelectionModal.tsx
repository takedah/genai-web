import {
  CustomDialog,
  CustomDialogBody,
  CustomDialogHeader,
  CustomDialogPanel,
} from '@/components/ui/CustomDialog';
import { MEETING_REPORT_CONTEXT } from '../constants';
import { useTranscribeStore } from '../stores/useTranscribeStore';
import { UseCaseItem } from './UseCaseItem';

type Props = {
  formattedOutput: string;
};

export const UseCaseSelectionModal = (props: Props) => {
  const { formattedOutput } = props;

  const { showModal, setShowModal } = useTranscribeStore();

  return (
    <CustomDialog
      isOpen={showModal}
      onClose={() => {
        setShowModal(false);
      }}
    >
      <CustomDialogPanel>
        <CustomDialogHeader hasClose={true} onClose={() => setShowModal(false)}>
          ユースケースを選択
        </CustomDialogHeader>
        <CustomDialogBody>
          <ul>
            <li>
              <UseCaseItem
                path='/generate/invoke'
                queryKey='information'
                text={formattedOutput}
                title='文章生成'
                onClose={() => {
                  setShowModal(false);
                }}
              />
            </li>
            <li>
              <UseCaseItem
                path='/translate/invoke'
                queryKey='sentence'
                text={formattedOutput}
                title='翻訳'
                onClose={() => {
                  setShowModal(false);
                }}
              />
            </li>
            <li>
              <UseCaseItem
                path='/generate/invoke'
                queryKey='information'
                text={formattedOutput}
                context={MEETING_REPORT_CONTEXT}
                title='議事録作成'
                onClose={() => {
                  setShowModal(false);
                }}
              />
            </li>
          </ul>
        </CustomDialogBody>
      </CustomDialogPanel>
    </CustomDialog>
  );
};
