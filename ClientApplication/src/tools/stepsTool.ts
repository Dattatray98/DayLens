import { tool } from '@langchain/core/tools';
import { GetStepsInputSchema } from './schemas';
import { Wellness } from '../native/Wellness';

export const getStepsTool = tool(
    async () => {
        const result = await Wellness.getSteps();

        if (result.permissionRequired) {
            return {
                success: false,
                action: 'get_steps',
                permissionRequired: true,
                message:
                    'Activity recognition permission is required to read steps.',
            };
        }

        if (!result.success) {
            return {
                success: false,
                action: 'get_steps',
                message: result.message ?? 'Unable to read step count.',
            };
        }

        return {
            success: true,
            action: 'get_steps',
            steps: result.steps ?? 0,
            source: 'native-android-step-counter',
            message: `You have ${result.steps ?? 0} steps.`,
        };
    },
    {
        name: 'get_steps',
        description:
            'Get the user step count from the native Android step counter sensor.',
        schema: GetStepsInputSchema,
    }
);
