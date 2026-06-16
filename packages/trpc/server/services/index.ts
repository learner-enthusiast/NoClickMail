import UserService from "@repo/services/user";
import GmailService from "@repo/services/gmail";
import CalendarService from "@repo/services/calendar";
import RunCorsairAgent from "@repo/services/open-ai_SDK";
export const userService = new UserService();
export const gmailService = new GmailService();
export const calendarService = new CalendarService();
export const CorsairAgent = RunCorsairAgent;
